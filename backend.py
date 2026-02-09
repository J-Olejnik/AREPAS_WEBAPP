from flask import Flask, request, render_template, jsonify
from flask_socketio import SocketIO
from tensorflow.keras.models import load_model # type: ignore
from tensorflow.keras.preprocessing.image import img_to_array # type: ignore
from tf_explain.core.grad_cam import GradCAM
from base64 import b64encode
from PIL import Image
import numpy as np
import io, os, logging, argparse, webbrowser, tempfile, threading
import sqlite3
from datetime import datetime

# Initialize the Flask app
app = Flask(__name__)
socketio = SocketIO(app, async_mode='threading', cors_allowed_origins="*")

# Initialize GradCAM
explainer = GradCAM()

# Global variables
app.config["active_clients"] = set()
app.config["log_file"] = f"logs/{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
app.config["shutdown_timer"] = None
app.config["db_path"] = None
app.config["model"] = None
app.config["model_name"] = None

# Socket setup
@socketio.on("connect")
def on_connect():
    if app.config["shutdown_timer"]:
        app.config["shutdown_timer"].cancel()
        app.config["shutdown_timer"] = None
    app.config["active_clients"].add(request.sid)

    model_exists = app.config["model"] is not None

    socketio.emit('notification', {
            'type': 'Success' if model_exists else 'Info',
            'message': 'Model is ready!' if model_exists else 'Model is loading...',
            'name': app.config["model_name"],
            'status': model_exists
        })

@socketio.on("disconnect")
def on_disconnect():
    app.config["active_clients"].discard(request.sid)
    if not app.config["active_clients"]:
        app.config["shutdown_timer"] = threading.Timer(5, lambda: (logs_cleanup(), os._exit(0)))
        app.config["shutdown_timer"].start()

# Logger setup
os.makedirs("logs", exist_ok=True)
logger = logging.getLogger("Error_logger")
handler = logging.FileHandler(app.config["log_file"])
handler.setFormatter(logging.Formatter(fmt="%(asctime)s | %(message)s", datefmt="%Y-%m-%d %H:%M:%S"))
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)

# Helper functions
def logs_cleanup():
    """Delete the log file used in this session if no errors were detected. \n
    No errors -> empty log file -> delete from disc to declutter."""

    handler.close()
    if os.path.getsize(app.config["log_file"]) == 0:
        os.remove(app.config["log_file"])

def background_model_load(source, name = None):
    """Background thread to load a model.\n
    If the model is provided as bytes via API, it is temporarily saved and then loaded (necessary due to keras restrictions). \n
    Otherwise, it is loaded directly from the file path on disk."""

    try:
        socketio.emit('notification', {
            'type': 'Info', 
            'message': 'Model is loading...',
            'status': False
        })

        if isinstance(source, (bytes, bytearray)):
            with tempfile.NamedTemporaryFile(suffix=".keras", delete=False) as tmp:
                tmp.write(source)
                tmp_path = tmp.name
            new_model = load_model(tmp_path) # tmp var in case loading fails
            app.config["model_name"] = name
            os.remove(tmp_path)
        elif isinstance(source, str) and os.path.exists(source):
            new_model = load_model(source)
            app.config["model_name"] = os.path.basename(source)
        else:
            raise ValueError("Invalid model source")
        
        app.config["model"] = new_model

        socketio.emit('notification', {
            'type': 'Success', 
            'message': 'Model loaded!', 
            'name': app.config["model_name"],
            'status': True
        })

    except Exception as e:
        logger.error(e, exc_info=True)
        socketio.emit('notification', {
            'type': 'Error', 
            'message': f'Model load failed: {e}',
            'name': app.config["model_name"],
            'status': app.config["model"] is not None
        })

def encode_image_base64(pil_image, format="JPEG"):
    """Encode a PIL image to a base64 string."""

    buffer = io.BytesIO()
    pil_image.save(buffer, format=format)
    buffer.seek(0)
    encoded = b64encode(buffer.getvalue()).decode('utf-8')
    return f"data:image/{format.lower()};base64,{encoded}"

def validate_file(file, allowed_ext, max_size, file_type="file"):
    """Validate file extension and size"""
    
    ext = os.path.splitext(file.filename.lower())[1]
    if ext not in allowed_ext:
        raise ValueError(f"Invalid {file_type} type. Allowed: {', '.join(allowed_ext)}")
    
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    
    if size > max_size:
        raise ValueError(f"{file_type.capitalize()} too large. Max: {max_size/(1024*1024):.0f}MB")

# API routes
@app.route('/')
def home():
    """Render the home page"""
    return render_template('index.html')

@app.route('/api/model-reload', methods=['POST'])
def model_reload():
    """Endpoint to reload the model"""

    if 'model_data' not in request.files:
        return jsonify({'error': 'Missing model data in request'}), 400
    
    try:  
        file = request.files['model_data']
        validate_file(file, {'.keras'}, 500 * 1024 * 1024, "model") # 500 MB
        model_bytes = file.read()
        model_name = request.form.get('filename')

        threading.Thread(target=background_model_load, args=(model_bytes, model_name), daemon=True).start()

        return jsonify({'status': 'Model data received successfully'}), 200
    
    except ValueError as e:
        logger.error(e, exc_info=True)
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(e, exc_info=True)
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/predict', methods=['POST'])
def predict():
    """Handle image prediction via POST request"""
    try:
        if 'files' not in request.files:
            return jsonify({'error': 'No files uploaded'}), 400
        
        if app.config["model"] is None:
            return jsonify({'error': 'Model not available'}), 503
        
        files = request.files.getlist('files')

        if not files or all(f.filename == '' for f in files):
            return jsonify({'error': 'No valid files provided'}), 400
    
        # Collect all images into a single batch
        img_arrays = []

        for file in files:
            # Validate each file
            validate_file(file, {'.jpg', '.jpeg', '.png'}, 10 * 1024 * 1024, "image") # 10 MB

            img = Image.open(file).convert('L')

            width, height = img.size
            if width > 410 or height > 350:
                return jsonify({'error': f"Image {file.filename} too large: {width}x{height}px. Valid size: 350x410px"}), 400
            
            img_array = img_to_array(img)
            img_arrays.append(img_array.astype("float32") / 255.0)
        
        # Stack images into a single batch tensor
        batch_images = np.stack(img_arrays)
        
        # Predict entire batch at once
        predictions = app.config["model"].predict(batch_images)

        # Process results for each image in the batch
        results = []
        for i, prediction in enumerate(predictions):
            prediction_list = [round(float(prediction[0]), 4), int(prediction[0] > 0.5)]

            # Generate Grad-CAM for this specific image
            img_array = np.expand_dims(img_arrays[i], axis=0)

            gradcam = explainer.explain((img_array, None), app.config["model"], class_index=0)
            gradcam = encode_image_base64(Image.fromarray(gradcam), format="JPEG")
            
            results.append({
                'predictions': prediction_list,
                'images': {
                    'gradcam': gradcam
                }
            })

        return jsonify(results)

    except ValueError as e:
        logger.error(e, exc_info=True)
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(e, exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/load-database')
def load_db():
    """Endpoint to load the database"""
    try:
        with sqlite3.connect(app.config["db_path"]) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT * FROM predictions ORDER BY pID ASC")
            rows = cur.fetchall()

        return jsonify([dict(row) for row in rows])
    except Exception as e:
        logger.error(e, exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/save-to-database', methods=['POST'])
def save_to_db():
    """Save new data to the database via POST request"""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "Invalid JSON"}), 400
        
        if "pID" not in data:
            return jsonify({"error": "Missing required field: pID"}), 400

        with sqlite3.connect(app.config["db_path"]) as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO predictions (
                    id,
                    pID,
                    date_of_prediction,
                    predicted_class,
                    prediction,
                    reviewer,
                    status,
                    annotation
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    reviewer = excluded.reviewer,
                    status = excluded.status,
                    annotation = excluded.annotation
            """, (
                int(data.get("id")) if data.get("id") else None,
                data.get("pID")[:15],
                datetime.now().strftime("%Y-%m-%d %H:%M"),
                int(data.get("predicted_class")),
                float(data.get("prediction")),
                data.get("reviewer")[:50],
                data.get("status") if data.get("status") in ["Open", "Reviewed", "Flagged"] else "Open",
                data.get("annotation")[:500]
            ))
            conn.commit()

        return jsonify({'status': 'New data saved successfully'}), 200
    except Exception as e:
        logger.error(e, exc_info=True)
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/delete-from-database', methods=['POST'])
def delete_from_db():
    """Delete the specified record form the database via POST request"""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "Invalid JSON"}), 400
        
        if "id" not in data:
            return jsonify({"error": "Missing required field: id"}), 400
        
        try:
            record_id = int(data.get("id"))
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid ID format"}), 400

        with sqlite3.connect(app.config["db_path"]) as conn:
            cur = conn.cursor()
            cur.execute(
                "DELETE FROM predictions WHERE id = ?",
                (record_id,)
            )
            conn.commit()

        return jsonify({'status': 'Record deleted successfully'}), 200
    except Exception as e:
        logger.error(e, exc_info=True)
        return jsonify({'error': str(e)}), 500
    
@app.route("/api/log-error", methods=["POST"])
def log_error():
    """Log frontend errors via POST request"""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "Invalid JSON"}), 400

        logger.error(data.get("error_msg", "Unknown error")[:1000])

        return jsonify({"status": "Error logged"}), 200
    except Exception as e:
        logger.error(e, exc_info=True)
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AREPAS GUI")
    parser.add_argument("--model", type=str, required=True, help="Path to the base model")
    parser.add_argument("--db", type=str, required=True, help="Path to the database")
    parser.add_argument("--port", type=int, required=False, default=5000, help="Port to run the app on")
    args = parser.parse_args()

    if not os.path.exists(args.model):
        logger.error(f"Error: Model file not found: {args.model}")
        os._exit(1)
    
    if not os.path.exists(args.db):
        logger.error(f"Error: Database file not found: {args.db}")
        os._exit(1)

    app.config["db_path"]=args.db

    threading.Thread(target=background_model_load, args=(args.model,), daemon=True).start()
    threading.Timer(1, webbrowser.open, args=[f"http://127.0.0.1:{args.port}"]).start()

    socketio.run(app, port=args.port, use_reloader=False)