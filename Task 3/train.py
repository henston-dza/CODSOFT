import os
import json
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import transforms

from vocab import Vocabulary
from dataset import ShapeDataset, CollateFN, setup_synthetic_dataset
from model import ImageCaptioner

def get_transforms():
    return transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])

def train_model(
    encoder_type="resnet50",
    decoder_type="lstm",
    epochs=15,
    lr=0.003,
    batch_size=8,
    data_dir="data",
    model_dir="models",
    progress_callback=None
):
    os.makedirs(model_dir, exist_ok=True)
    os.makedirs(data_dir, exist_ok=True)
    
    # 1. Setup/Load Dataset
    json_path = os.path.join(data_dir, "dataset.json")
    if os.path.exists(json_path):
        with open(json_path, "r") as f:
            data_list = json.load(f)
    else:
        print("Dataset file not found. Generating a new synthetic dataset...")
        data_list = setup_synthetic_dataset(data_dir, num_samples=60)
        
    # 2. Build Vocabulary
    vocab_path = os.path.join(model_dir, "vocab.json")
    vocab = Vocabulary()
    captions = [item["caption"] for item in data_list]
    vocab.build_vocab_from_captions(captions, min_word_freq=1)
    vocab.save(vocab_path)
    print(f"Vocabulary built and saved. Vocab size: {len(vocab)}")
    
    # 3. Create Data Loader
    transform = get_transforms()
    dataset = ShapeDataset(data_list, vocab, transform=transform)
    pad_idx = vocab.word2idx["<pad>"]
    
    loader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=True,
        collate_fn=CollateFN(pad_idx),
        drop_last=False
    )
    
    # 4. Initialize Model
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    embed_size = 256
    hidden_size = 256
    num_layers = 1
    
    model = ImageCaptioner(
        vocab_size=len(vocab),
        embed_size=embed_size,
        hidden_size=hidden_size,
        encoder_type=encoder_type,
        decoder_type=decoder_type,
        num_layers=num_layers
    ).to(device)
    
    # 5. Define Loss & Optimizer
    criterion = nn.CrossEntropyLoss(ignore_index=pad_idx)
    # We only optimize parameters that require grads (CNN weights are frozen, fc and decoder weights are trainable)
    trainable_params = [p for p in model.parameters() if p.requires_grad]
    optimizer = optim.Adam(trainable_params, lr=lr)
    
    # 6. Training Loop
    model.train()
    history = []
    
    for epoch in range(1, epochs + 1):
        epoch_loss = 0.0
        batch_count = 0
        
        for images, captions, lengths in loader:
            images = images.to(device)
            captions = captions.to(device)
            
            # Zero grads
            optimizer.zero_grad()
            
            # Forward pass
            outputs = model(images, captions) # shape: (batch_size, seq_len, vocab_size)
            
            # Calculate loss (flatten for cross entropy)
            outputs = outputs.view(-1, len(vocab))
            targets = captions.view(-1)
            
            loss = criterion(outputs, targets)
            
            # Backward and step
            loss.backward()
            optimizer.step()
            
            epoch_loss += loss.item()
            batch_count += 1
            
        avg_loss = epoch_loss / batch_count
        history.append({"epoch": epoch, "loss": avg_loss})
        
        print(f"Epoch [{epoch}/{epochs}], Loss: {avg_loss:.4f}")
        
        # Trigger progress callback if present
        if progress_callback:
            progress_callback(epoch, epochs, avg_loss)
            
    # 7. Save Model Weights
    model_name = f"model_{encoder_type.lower()}_{decoder_type.lower()}.pth"
    model_path = os.path.join(model_dir, model_name)
    torch.save(model.state_dict(), model_path)
    print(f"Model saved to {model_path}")
    
    return history

if __name__ == "__main__":
    # Test run
    train_model(encoder_type="resnet50", decoder_type="lstm", epochs=5, batch_size=8)
