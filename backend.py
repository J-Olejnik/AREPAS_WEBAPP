from flask import Flask, request, render_template, jsonify
from tensorflow.keras.models import load_model # type: ignore
from tensorflow.keras.preprocessing.image import img_to_array # type: ignore
from tf_explain.core.grad_cam import GradCAM
from base64 import b64encode
from PIL import Image
import numpy as np
import io
import os
import threading
import tempfile
import argparse
import webbrowser

# Initialize the Flask app
app = Flask(__name__)

# Initialize GradCAM
explainer = GradCAM()

# Global model and error variables
model = None
model_error = None
model_loaded = False
model_name = None

def background_model_load(source):
    """Background thread to load a model.\n
    If the model is provided as bytes via API, it is temporarily saved and then loaded. \n
    Otherwise, it is loaded directly from the file path on disk."""
    global model, model_error, model_loaded, model_name
    
    try:
        if isinstance(source, (bytes, bytearray)):
            with tempfile.NamedTemporaryFile(suffix=".keras", delete=False) as tmp:
                tmp.write(source)
                tmp_path = tmp.name
            model = load_model(tmp_path)
            os.remove(tmp_path)
        elif isinstance(source, str) and os.path.exists(source):
            model_name = os.path.basename(source)
            print(source, model_name)
            model = load_model(source)
        else:
            raise ValueError("Invalid model source")
        model_loaded = True
    except Exception as e:
        model_error = str(e)
        model_loaded = False

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

@app.route('/model-status')
def model_status():
    """Endpoint to check model status"""
    return jsonify({
        'status': model_loaded,
        'error': model_error,
        'name': model_name
    })

@app.route('/model-reload', methods=['POST'])
def model_reload():
    """Endpoint to reload the model"""
    global model_loaded, model_name

    # Check if file is in the request
    if 'model_data' not in request.files:
        return jsonify({'error': 'Missing model data in request'}), 400
    
    try:  
        file = request.files['model_data']
        model_bytes = file.read()

        model_name = request.form.get('filename')
        model_loaded = False
        threading.Thread(target=background_model_load, args=(model_bytes,), daemon=True).start()

        return jsonify({'status': 'Model data received successfully'}), 200
    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500
    
@app.route('/predict', methods=['POST'])
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
        predictions = model.predict(batch_images)

        # Process results for each image in the batch
        results = []
        for i, prediction in enumerate(predictions):
            prediction_list = [round(float(prediction[0]), 4), int(prediction[0] > 0.5)]

            # Generate Grad-CAM for this specific image
            img_array = np.expand_dims(img_arrays[i], axis=0)

            gradcam = explainer.explain((img_array, None), model, class_index=0)
            gradcam = encode_image_base64(Image.fromarray(gradcam), format="JPEG")
            
            results.append({
                'predictions': prediction_list,
                'images': {
                    'gradcam': gradcam
                }
            })
        
        return jsonify(results)

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
# @app.route('/description', methods=['GET', 'POST'])
# def handleDescription():
#     return jsonify()
    
@app.route('/<pageName>.html')
def load_page(pageName):
    try:
        return render_template(f'{pageName}.html')
    except FileNotFoundError:
        return "Page not found", 404

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AREPAS GUI")
    parser.add_argument("--model", type=str, required=True, help="Path to the base model")
    parser.add_argument("--port", type=int, required=False, default=5000, help="Port to run the app on")
    args = parser.parse_args()

    threading.Thread(target=background_model_load, args=(args.model,), daemon=True).start()
    threading.Timer(1, webbrowser.open, args=[f"http://127.0.0.1:{args.port}"]).start()

    app.run(port=args.port)