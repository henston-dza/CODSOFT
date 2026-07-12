import torch
import torch.nn as nn
import torchvision.models as models

class EncoderCNN(nn.Module):
    def __init__(self, embed_size, encoder_type="resnet50"):
        super().__init__()
        self.encoder_type = encoder_type.lower()
        
        if self.encoder_type == "resnet50":
            try:
                resnet = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
            except AttributeError:
                resnet = models.resnet50(pretrained=True)
            # Remove classification layer (fc)
            modules = list(resnet.children())[:-1]
            self.cnn = nn.Sequential(*modules)
            self.fc = nn.Linear(resnet.fc.in_features, embed_size)
        elif self.encoder_type == "vgg16":
            try:
                vgg = models.vgg16(weights=models.VGG16_Weights.DEFAULT)
            except AttributeError:
                vgg = models.vgg16(pretrained=True)
            # Remove classification classifier, use features + avgpool to get 512-dim features
            self.cnn = nn.Sequential(
                vgg.features,
                nn.AdaptiveAvgPool2d((1, 1))
            )
            self.fc = nn.Linear(512, embed_size)
        else:
            raise ValueError(f"Unknown encoder type: {encoder_type}")
        
        # Freeze weights of the pre-trained feature extractor
        for param in self.cnn.parameters():
            param.requires_grad = False
            
        self.bn = nn.BatchNorm1d(embed_size, momentum=0.01)

    def forward(self, images):
        with torch.no_grad():
            features = self.cnn(images)
        features = features.view(features.size(0), -1)
        features = self.bn(self.fc(features))
        return features

class DecoderRNN(nn.Module):
    def __init__(self, vocab_size, embed_size, hidden_size, num_layers=1):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_size)
        self.lstm = nn.LSTM(embed_size, hidden_size, num_layers, batch_first=True)
        self.linear = nn.Linear(hidden_size, vocab_size)

    def forward(self, features, captions):
        # captions: (batch, seq_len)
        embeddings = self.embed(captions[:, :-1]) # (batch, seq_len - 1, embed_size)
        # Prepend image features: (batch, 1, embed_size)
        inputs = torch.cat((features.unsqueeze(1), embeddings), dim=1) # (batch, seq_len, embed_size)
        hiddens, _ = self.lstm(inputs)
        outputs = self.linear(hiddens)
        return outputs

    def generate(self, features, vocab, max_len=20):
        """Greedy search for caption generation."""
        batch_size = features.size(0)
        state = None
        
        # Step 0 input: image features (already projected to embed_size)
        inputs = features.unsqueeze(1) # (batch, 1, embed_size)
        
        caption_indices = []
        
        for _ in range(max_len):
            hiddens, state = self.lstm(inputs, state) # hiddens: (batch, 1, hidden_size)
            outputs = self.linear(hiddens.squeeze(1)) # outputs: (batch, vocab_size)
            _, predicted = outputs.max(1)
            
            caption_indices.append(predicted)
            
            # Prepare next input: embed the predicted token
            inputs = self.embed(predicted).unsqueeze(1) # (batch, 1, embed_size)
            
        caption_indices = torch.stack(caption_indices, dim=1) # (batch, max_len)
        return caption_indices

class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=100):
        super().__init__()
        self.pos_embed = nn.Embedding(max_len, d_model)

    def forward(self, x):
        seq_len = x.size(1)
        positions = torch.arange(0, seq_len, device=x.device).unsqueeze(0)
        return x + self.pos_embed(positions)

class DecoderTransformer(nn.Module):
    def __init__(self, vocab_size, embed_size, num_heads=4, num_layers=2, dropout=0.1, max_len=100):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_size)
        self.pos_encoder = PositionalEncoding(embed_size, max_len)
        
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=embed_size,
            nhead=num_heads,
            dim_feedforward=512,
            dropout=dropout,
            batch_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.linear = nn.Linear(embed_size, vocab_size)

    def forward(self, features, captions):
        embeddings = self.embed(captions[:, :-1])
        inputs = torch.cat((features.unsqueeze(1), embeddings), dim=1)
        inputs = self.pos_encoder(inputs)
        
        seq_len = inputs.size(1)
        mask = torch.triu(torch.ones(seq_len, seq_len, device=inputs.device), diagonal=1).bool()
        
        hiddens = self.transformer(inputs, mask=mask)
        outputs = self.linear(hiddens)
        return outputs

    def generate(self, features, vocab, max_len=20):
        """Autoregressive generation using Transformer decoder."""
        batch_size = features.size(0)
        device = features.device
        
        # Start token
        start_idx = vocab.word2idx["<start>"]
        generated = torch.tensor([[start_idx]], device=device) # (batch, 1)
        
        for _ in range(max_len - 1):
            embeddings = self.embed(generated) # (batch, cur_seq_len, embed_size)
            # Prepend image features: features is (batch, embed_size)
            inputs = torch.cat((features.unsqueeze(1), embeddings), dim=1) # (batch, cur_seq_len + 1, embed_size)
            inputs = self.pos_encoder(inputs)
            
            seq_len = inputs.size(1)
            mask = torch.triu(torch.ones(seq_len, seq_len, device=device), diagonal=1).bool()
            
            hiddens = self.transformer(inputs, mask=mask) # (batch, seq_len, embed_size)
            # We look at the prediction for the last token in the sequence
            outputs = self.linear(hiddens[:, -1, :]) # (batch, vocab_size)
            _, predicted = outputs.max(1) # (batch,)
            
            # Append predicted token
            generated = torch.cat((generated, predicted.unsqueeze(1)), dim=1)
            
            if predicted.item() == vocab.word2idx["<end>"]:
                break
                
        # Return generated sequence, excluding the starting token for LSTM similarity
        return generated[:, 1:]

class ImageCaptioner(nn.Module):
    def __init__(self, vocab_size, embed_size, hidden_size, encoder_type="resnet50", decoder_type="lstm", num_layers=1):
        super().__init__()
        self.encoder = EncoderCNN(embed_size, encoder_type)
        self.decoder_type = decoder_type.lower()
        
        if self.decoder_type == "lstm":
            self.decoder = DecoderRNN(vocab_size, embed_size, hidden_size, num_layers)
        elif self.decoder_type == "transformer":
            self.decoder = DecoderTransformer(vocab_size, embed_size, num_heads=4, num_layers=num_layers)
        else:
            raise ValueError(f"Unknown decoder type: {decoder_type}")

    def forward(self, images, captions):
        features = self.encoder(images)
        outputs = self.decoder(features, captions)
        return outputs

    def generate(self, image, vocab, max_len=20):
        self.eval()
        with torch.no_grad():
            features = self.encoder(image)
            caption_indices = self.decoder.generate(features, vocab, max_len)
        return caption_indices
