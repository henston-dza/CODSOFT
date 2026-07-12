import os
import json
import queue
import threading
from PIL import Image
import torch
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from torchvision import transforms

from vocab import Vocabulary
from model import ImageCaptioner
from train import train_model, get_transforms
from dataset import setup_synthetic_dataset

app = FastAPI(title="Interactive Image Captioning AI")

# CORS middleware to allow local requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# App directories
DATA_DIR = "data"
MODEL_DIR = "models"
STATIC_DIR = "static"
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

# Configuration state
config_path = os.path.join(MODEL_DIR, "active_config.json")
default_config = {
    "encoder_type": "resnet50",
    "decoder_type": "lstm"
}

if not os.path.exists(config_path):
    with open(config_path, "w") as f:
        json.dump(default_config, f)

def get_current_config():
    try:
        with open(config_path, "r") as f:
            return json.load(f)
    except Exception:
        return default_config

def save_current_config(config):
    with open(config_path, "w") as f:
        json.dump(config, f, indent=4)

# Global queue for streaming training logs
progress_queue = queue.Queue()
training_lock = threading.Lock()
is_training_running = False

def run_training_thread(encoder_type, decoder_type, epochs, lr, batch_size):
    global is_training_running
    try:
        def callback(epoch, total_epochs, loss):
            progress_queue.put({
                "epoch": epoch,
                "total_epochs": total_epochs,
                "loss": loss,
                "done": False,
                "error": None
            })
            
        train_model(
            encoder_type=encoder_type,
            decoder_type=decoder_type,
            epochs=epochs,
            lr=lr,
            batch_size=batch_size,
            data_dir=DATA_DIR,
            model_dir=MODEL_DIR,
            progress_callback=callback
        )
        
        progress_queue.put({
            "epoch": epochs,
            "total_epochs": epochs,
            "loss": 0.0,
            "done": True,
            "error": None
        })
    except Exception as e:
        progress_queue.put({
            "epoch": 0,
            "total_epochs": epochs,
            "loss": 0.0,
            "done": True,
            "error": str(e)
        })
    finally:
        with training_lock:
            is_training_running = False

def load_active_model():
    cfg = get_current_config()
    vocab_path = os.path.join(MODEL_DIR, "vocab.json")
    if not os.path.exists(vocab_path):
        return None, None, "Vocabulary not found. Please run the training first."

    vocab = Vocabulary.load(vocab_path)
    
    model_name = f"model_{cfg['encoder_type'].lower()}_{cfg['decoder_type'].lower()}.pth"
    model_path = os.path.join(MODEL_DIR, model_name)
    if not os.path.exists(model_path):
        return None, None, f"Pre-trained weights for '{cfg['encoder_type']} + {cfg['decoder_type']}' not found. Please train the model first."
        
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = ImageCaptioner(
        vocab_size=len(vocab),
        embed_size=256,
        hidden_size=256,
        encoder_type=cfg["encoder_type"],
        decoder_type=cfg["decoder_type"],
        num_layers=1
    ).to(device)
    
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.eval()
    return model, vocab, None

@app.get("/")
def serve_index():
    return FileResponse("static/index.html")

@app.get("/api/config")
def get_config():
    return get_current_config()

@app.post("/api/config")
def update_config(config: dict):
    if "encoder_type" not in config or "decoder_type" not in config:
        raise HTTPException(status_code=400, detail="Invalid config parameters.")
    save_current_config(config)
    return {"message": "Config updated successfully", "config": config}

@app.post("/api/train")
def start_training(background_tasks: BackgroundTasks, params: dict = None):
    global is_training_running
    
    if params is None:
        params = {}
        
    epochs = params.get("epochs", 15)
    lr = params.get("lr", 0.003)
    batch_size = params.get("batch_size", 8)
    
    cfg = get_current_config()
    
    with training_lock:
        if is_training_running:
            raise HTTPException(status_code=400, detail="Training is already in progress.")
        is_training_running = True
        
    # Drain any leftover progress in the queue
    while not progress_queue.empty():
        try:
            progress_queue.get_nowait()
        except queue.Empty:
            break
            
    # Start thread
    threading.Thread(
        target=run_training_thread,
        args=(cfg["encoder_type"], cfg["decoder_type"], epochs, lr, batch_size),
        daemon=True
    ).start()
    
    return {"message": "Training started in background."}

@app.get("/api/train/stream")
def stream_training_logs():
    def event_generator():
        while True:
            try:
                # Wait for progress update
                data = progress_queue.get(timeout=2.0)
                yield f"data: {json.dumps(data)}\n\n"
                if data.get("done", False):
                    break
            except queue.Empty:
                yield "data: {\"ping\": true}\n\n"
                
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/caption")
async def caption_image(file: UploadFile = File(...)):
    # Save the uploaded file temporarily
    filename = f"query_{file.filename}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    try:
        with open(filepath, "wb") as buffer:
            buffer.write(await file.read())
            
        # Load active model
        model, vocab, err = load_active_model()
        if err:
            raise HTTPException(status_code=400, detail=err)
            
        # Load and transform image
        image = Image.open(filepath).convert("RGB")
        transform = get_transforms()
        image_tensor = transform(image).unsqueeze(0) # (1, 3, 224, 224)
        
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        image_tensor = image_tensor.to(device)
        
        # Run inference
        pred_indices = model.generate(image_tensor, vocab)
        caption = vocab.decode(pred_indices[0])
        
        return {"caption": caption, "image_url": f"/data/uploads/{filename}"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

@app.get("/api/dataset")
def get_dataset():
    json_path = os.path.join(DATA_DIR, "dataset.json")
    if not os.path.exists(json_path):
        setup_synthetic_dataset(DATA_DIR, num_samples=60)
        
    with open(json_path, "r") as f:
        return json.load(f)

@app.post("/api/dataset/add")
async def add_dataset_sample(file: UploadFile = File(...), caption: str = Form(...)):
    filename = f"user_{random_id()}_{file.filename}"
    filepath = os.path.join(DATA_DIR, filename)
    
    try:
        # Save custom image
        with open(filepath, "wb") as buffer:
            buffer.write(await file.read())
            
        # Update dataset.json
        json_path = os.path.join(DATA_DIR, "dataset.json")
        if not os.path.exists(json_path):
            data_list = setup_synthetic_dataset(DATA_DIR, num_samples=60)
        else:
            with open(json_path, "r") as f:
                data_list = json.load(f)
                
        new_sample = {
            "image_path": filepath,
            "caption": caption,
            "shape": "custom",
            "color": "custom",
            "bg": "custom"
        }
        data_list.append(new_sample)
        
        with open(json_path, "w") as f:
            json.dump(data_list, f, indent=4)
            
        return {"message": "Sample added successfully", "sample": new_sample}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add sample: {str(e)}")

def random_id():
    import uuid
    return uuid.uuid4().hex[:6]

# Serve static files and data files
app.mount("/data", StaticFiles(directory="data"), name="data")
app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    # Make sure dataset.json exists on launch
    dataset_json = os.path.join(DATA_DIR, "dataset.json")
    if not os.path.exists(dataset_json):
        setup_synthetic_dataset(DATA_DIR, num_samples=60)
        
    uvicorn.run(app, host="127.0.0.1", port=8000)
