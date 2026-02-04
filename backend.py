from flask import Flask, request, render_template, jsonify
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
os.makedirs("logs", exist_ok=True)

# Initialize GradCAM
explainer = GradCAM()

# Global variables
app.config["session_id"] = datetime.now().strftime("%Y%m%d_%H%M%S")
app.config["log_file"] = f"logs/{app.config['session_id']}.log"
app.config["log_format"] = "%(asctime)s | %(message)s"
app.config["model"] = None
app.config["model_error"] = None
app.config["model_loaded"] = False
app.config["model_name"] = None
app.config["db_path"] = None

# Logger setup
logger = logging.getLogger("Error_logger")
handler = logging.FileHandler(app.config["log_file"])
handler.setFormatter(logging.Formatter(app.config["log_format"], datefmt="%Y-%m-%d %H:%M:%S"))
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)

def background_model_load(source):
    """Background thread to load a model.\n
    If the model is provided as bytes via API, it is temporarily saved and then loaded. \n
    Otherwise, it is loaded directly from the file path on disk."""
    
    try:
        if isinstance(source, (bytes, bytearray)):
            with tempfile.NamedTemporaryFile(suffix=".keras", delete=False) as tmp:
                tmp.write(source)
                tmp_path = tmp.name
            app.config["model"] = load_model(tmp_path)
            os.remove(tmp_path)
        elif isinstance(source, str) and os.path.exists(source):
            app.config["model_name"] = os.path.basename(source)
            app.config["model"] = load_model(source)
        else:
            raise ValueError("Invalid model source")
        app.config["model_loaded"] = True
    except Exception as e:
        logger.error(e, exc_info=True)
        app.config["model_error"] = str(e)
        app.config["model_loaded"] = False

def encode_image_base64(pil_image, format="JPEG"):
    """Encode a PIL image to a base64 string."""
    buffer = io.BytesIO()
    pil_image.save(buffer, format=format)
    buffer.seek(0)
    encoded = b64encode(buffer.getvalue()).decode('utf-8')
    return f"data:image/{format.lower()};base64,{encoded}"

@app.route('/')
def home():
    """Render the home page"""
    return render_template('index.html')

@app.route('/api/model-status')
def model_status():
    """Endpoint to check model status"""
    return jsonify({
        'status': app.config["model_loaded"],
        'error': app.config["model_error"],
        'name': app.config["model_name"]
    })

@app.route('/api/model-reload', methods=['POST'])
def model_reload():
    """Endpoint to reload the model"""

    # Check if file is in the request
    if 'model_data' not in request.files:
        return jsonify({'error': 'Missing model data in request'}), 400
    
    try:  
        file = request.files['model_data']
        model_bytes = file.read()

        app.config["model_name"] = request.form.get('filename')
        app.config["model_error"] = None
        app.config["model_loaded"] = False
        threading.Thread(target=background_model_load, args=(model_bytes,), daemon=True).start()

        return jsonify({'status': 'Model data received successfully'}), 200
    except Exception as e:
        logger.error(e, exc_info=True)
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/predict', methods=['POST'])
def predict():
    """Handle image prediction via POST request"""
    try:
        # Check if file is in the request
        if 'files' not in request.files:
            return jsonify({'error': 'No files uploaded'}), 400
        
        files = request.files.getlist('files')
    
        # Collect all images into a single batch
        img_arrays = []

        for file in files:
            img = Image.open(file).convert('L')
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

    except Exception as e:
        logger.error(e, exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/load-database')
def load_db():
    """Endpoint to load the database"""
    try:
        conn = sqlite3.connect(app.config["db_path"])
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        cur.execute("SELECT * FROM predictions ORDER BY pID ASC")
        rows = cur.fetchall()

        conn.close()
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

        conn = sqlite3.connect(app.config["db_path"])
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
            int(data["id"]) if data["id"] else None,
            data["pID"][:15],
            datetime.now().strftime("%Y-%m-%d %H:%M"),
            int(data["predicted_class"]),
            float(data["prediction"]),
            data["reviewer"][:50],
            data["status"] if data["status"] in ["Open", "Reviewed", "Flagged"] else "Open",
            data["annotation"][:500]
        ))

        conn.commit()
        conn.close()

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

        conn = sqlite3.connect(app.config["db_path"])
        cur = conn.cursor()

        cur.execute(
            "DELETE FROM predictions WHERE id = ?",
            (int(data["id"]),)
        )

        conn.commit()
        conn.close()

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

        logger.error(data["error_msg"][:1000])

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

    app.config["db_path"]=args.db

    threading.Thread(target=background_model_load, args=(args.model,), daemon=True).start()
    threading.Timer(1, webbrowser.open, args=[f"http://127.0.0.1:{args.port}"]).start()

    app.run(port=args.port)