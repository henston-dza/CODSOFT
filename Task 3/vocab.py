import json
import re

class Vocabulary:
    def __init__(self):
        self.word2idx = {}
        self.idx2word = {}
        self.idx = 0
        self.add_word("<pad>")  # Index 0
        self.add_word("<start>")  # Index 1
        self.add_word("<end>")  # Index 2
        self.add_word("<unk>")  # Index 3

    def add_word(self, word):
        if word not in self.word2idx:
            self.word2idx[word] = self.idx
            self.idx2word[self.idx] = word
            self.idx += 1

    def clean_text(self, text):
        # Convert to lowercase and remove punctuation except standard word boundaries
        text = text.lower().strip()
        text = re.sub(r'[^\w\s]', '', text)
        return text

    def build_vocab_from_captions(self, captions, min_word_freq=1):
        word_counts = {}
        for caption in captions:
            clean_cap = self.clean_text(caption)
            tokens = clean_cap.split()
            for token in tokens:
                word_counts[token] = word_counts.get(token, 0) + 1

        for word, count in word_counts.items():
            if count >= min_word_freq:
                self.add_word(word)

    def numericalize(self, text):
        clean_cap = self.clean_text(text)
        tokens = clean_cap.split()
        numericalized = [self.word2idx["<start>"]]
        for token in tokens:
            if token in self.word2idx:
                numericalized.append(self.word2idx[token])
            else:
                numericalized.append(self.word2idx["<unk>"])
        numericalized.append(self.word2idx["<end>"])
        return numericalized

    def decode(self, indices):
        words = []
        for idx in indices:
            # If idx is a tensor, convert to int
            if hasattr(idx, 'item'):
                idx = idx.item()
            word = self.idx2word.get(idx, "<unk>")
            if word == "<end>":
                break
            if word not in ["<pad>", "<start>"]:
                words.append(word)
        return " ".join(words)

    def save(self, filepath):
        with open(filepath, 'w') as f:
            json.dump({
                'word2idx': self.word2idx,
                'idx2word': {str(k): v for k, v in self.idx2word.items()},
                'idx': self.idx
            }, f, indent=4)

    @classmethod
    def load(cls, filepath):
        with open(filepath, 'r') as f:
            data = json.load(f)
        vocab = cls()
        vocab.word2idx = data['word2idx']
        vocab.idx2word = {int(k): v for k, v in data['idx2word'].items()}
        vocab.idx = data['idx']
        return vocab

    def __len__(self):
        return len(self.word2idx)
