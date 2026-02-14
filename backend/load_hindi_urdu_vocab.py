"""
Small helper script to load Hindi and Urdu CSVs into the SQLite DB using existing db.load_vocabulary_from_csv
Run from repo root: python backend/load_hindi_urdu_vocab.py
"""
from backend import db

if __name__ == '__main__':
    print('Initializing DB...')
    db.init_db()
    print('Loading Hindi CSV...')
    db.load_vocabulary_from_csv('hindi')
    print('Loading Urdu CSV...')
    db.load_vocabulary_from_csv('urdu')
    print('Done')
