import os
import json
import random
from PIL import Image, ImageDraw
import torch
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms

class ShapeDataset(Dataset):
    def __init__(self, data_list, vocab, transform=None):
        self.data_list = data_list
        self.vocab = vocab
        self.transform = transform

    def __len__(self):
        return len(self.data_list)

    def __getitem__(self, index):
        item = self.data_list[index]
        image_path = item["image_path"]
        caption = item["caption"]

        image = Image.open(image_path).convert("RGB")
        
        if self.transform is not None:
            image = self.transform(image)
        else:
            # Default fallback transform
            default_transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                )
            ])
            image = default_transform(image)

        numericalized_caption = self.vocab.numericalize(caption)
        caption_tensor = torch.tensor(numericalized_caption)

        return image, caption_tensor

class CollateFN:
    def __init__(self, pad_idx):
        self.pad_idx = pad_idx

    def __call__(self, batch):
        images = [item[0].unsqueeze(0) for item in batch]
        images = torch.cat(images, dim=0)

        targets = [item[1] for item in batch]
        lengths = [len(tar) for tar in targets]
        
        # Pad target sequences
        max_len = max(lengths)
        padded_targets = torch.zeros(len(targets), max_len).long().fill_(self.pad_idx)
        for i, tar in enumerate(targets):
            padded_targets[i, :len(tar)] = tar

        return images, padded_targets, torch.tensor(lengths)

def generate_shape_image(filepath, shape, color, bg_color):
    """Generates a synthetic shape image and saves it to disk."""
    width, height = 224, 224
    image = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(image)

    # Coordinates for shapes
    padding = 40
    left, top = padding, padding
    right, bottom = width - padding, height - padding

    color_map = {
        "red": (255, 0, 0),
        "green": (0, 255, 0),
        "blue": (0, 0, 255),
        "yellow": (255, 255, 0),
        "magenta": (255, 0, 255),
        "cyan": (0, 255, 255),
        "orange": (255, 165, 0),
        "purple": (128, 0, 128)
    }

    fill_color = color_map.get(color, (128, 128, 128))

    if shape == "circle":
        draw.ellipse([left, top, right, bottom], fill=fill_color)
    elif shape == "square":
        draw.rectangle([left, top, right, bottom], fill=fill_color)
    elif shape == "triangle":
        draw.polygon([(width // 2, top), (left, bottom), (right, bottom)], fill=fill_color)
    elif shape == "rectangle":
        draw.rectangle([left, top + 20, right, bottom - 20], fill=fill_color)
    else:  # Star or fallback diamond
        draw.polygon([(width // 2, top), (right, height // 2), (width // 2, bottom), (left, height // 2)], fill=fill_color)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    image.save(filepath)

def setup_synthetic_dataset(data_dir, num_samples=60):
    """Generates synthetic dataset of shapes and colors and saves dataset.json."""
    os.makedirs(data_dir, exist_ok=True)
    
    shapes = ["circle", "square", "triangle", "rectangle"]
    colors = ["red", "green", "blue", "yellow", "magenta", "cyan", "orange", "purple"]
    bg_colors = ["black", "white", "gray"]

    data_list = []

    # Generate samples
    for i in range(num_samples):
        shape = random.choice(shapes)
        color = random.choice(colors)
        bg = random.choice(bg_colors)

        filename = f"shape_{i}_{shape}_{color}_{bg}.png"
        filepath = os.path.join(data_dir, filename)

        generate_shape_image(filepath, shape, color, bg)

        # Captions can vary slightly to make the task realistic
        caption = f"a {color} {shape} on a {bg} background"
        
        # Add relative path for backend/frontend mapping
        data_list.append({
            "image_path": filepath,
            "caption": caption,
            "shape": shape,
            "color": color,
            "bg": bg
        })

    json_path = os.path.join(data_dir, "dataset.json")
    with open(json_path, "w") as f:
        json.dump(data_list, f, indent=4)

    return data_list
