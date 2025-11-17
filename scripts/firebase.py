import argparse
import firebase_admin
import datetime
import json
from firebase_admin import credentials, firestore

def initialize_firebase():
    try:
        cred = credentials.Certificate("private_key.json")
        firebase_admin.initialize_app(cred)
        return firestore.client()
    except Exception as e:
        print(f"Error initializing Firebase: {e}")
        return None
def delete_table(db, table_name):
    print(f"🗑️ Overwrite mode: Deleting all existing {table_name}...")
            
    existing_docs = db.collection(table_name).get()
    
    if existing_docs:
        BATCH_SIZE = 500
        docs_to_delete = [doc.reference for doc in existing_docs]
        
        for i in range(0, len(docs_to_delete), BATCH_SIZE):
            batch = db.batch()
            batch_docs = docs_to_delete[i:i + BATCH_SIZE]
            
            for doc_ref in batch_docs:
                batch.delete(doc_ref)
            
            batch.commit()
            print(f"🗑️ Deleted batch of {len(batch_docs)}")
        
        print(f"✅ Deleted {len(existing_docs)} existing")
    else:
        print(f"ℹ️ No existing {table_name} found to delete")

def batch_insert(db, new_characters):
    # Insert new characters in batches
    successful, failed = 0, 0
    if new_characters:
        BATCH_SIZE = 500
        total_batches = (len(new_characters) + BATCH_SIZE - 1) // BATCH_SIZE
        
        print(f"📤 Inserting {len(new_characters)} characters in {total_batches} batch(es)...")
        
        for i in range(0, len(new_characters), BATCH_SIZE):
            batch = db.batch()
            batch_chars = new_characters[i:i + BATCH_SIZE]
            batch_number = (i // BATCH_SIZE) + 1
            
            try:
                for char_doc in batch_chars:
                    doc_ref = db.collection("characters").document()
                    batch.set(doc_ref, char_doc)
                
                batch.commit()
                successful += len(batch_chars)
                print(f"✅ Batch {batch_number}/{total_batches}: Added {len(batch_chars)} characters")
                
            except Exception as e:
                print(f"❌ Batch {batch_number}/{total_batches} failed: {e}")
                failed += len(batch_chars)
    else:
        print("ℹ️ No new characters to add")
    return successful, failed

def seed_character_table_ch(db, premium_level_start = 4, overwrite_all = False):
    try:
        new_characters = []
        existing_chars_set = set()
        
        if not overwrite_all:
            print("🔍 Checking for existing characters...")
            existing_chars_query = db.collection("characters").select(["content"]).get()
            existing_chars_set = {doc.get("content") for doc in existing_chars_query if doc.get("language") == "ch"}
            print(f"ℹ️ Found {len(existing_chars_set)} existing characters")
        
        # https://github.com/KevinVR/hsk-json-list/blob/master/hsk.json
        with open("hsk.json","r") as f:
            file_chars = json.load(f)
        for char_information in file_chars:
            char = char_information["hanzi"]
            if not overwrite_all and char in existing_chars_set:
                print(f"Character '{char}' already exists, skipping...")
                continue
            if len(char) > 1:
                print(f"Character '{char}' is above length 1, skipping...")
                continue
            char_doc = char_information
            char_doc["meanings"] = [x for x in char_doc.pop("translations") if "[" not in x]
            char_doc["difficulty"] = char_doc.pop("level")
            char_doc["content"] = char,
            char_doc["is_premium"] = False,
            char_doc["created_at"] = datetime.datetime.now(datetime.timezone.utc),
            char_doc["language"] = "ch"
            new_characters.append(char_doc)
        print(f"Prepared {len(new_characters)}")

        successful, failed = batch_insert(db, new_characters)
        # Summary
        print(f"\n📊 Character seeding summary:")
        print(f"   • Successfully added: {successful}")
        print(f"   • Failed: {failed}")
        if not overwrite_all:
            print(f"   • Already existed: {len(existing_chars_set)}")
        print(f"   • Total in database: {successful + (0 if overwrite_all else len(existing_chars_set))}")

    except Exception as e:
        print(f"Error in seed_character_table_ch: {e}")
        raise


def seed_character_table_jp(db, overwrite_all = False):
    try:
        new_characters = []
        existing_chars_set = set()
        if not overwrite_all:
            print("Checking for existing characters...")
            existing_chars_query = db.collection("characters").select(["content"]).get()
            existing_chars_set = {doc.get("content") for doc in existing_chars_query if doc.get("language") == "jp"}
            print(f"Found {len(existing_chars_set)} existing characters")

        # https://github.com/davidluzgouveia/kanji-data/blob/master/kanji-wanikani.json
        with open("kanji-wanikani.json","r") as f:
            file_chars = json.load(f)
        for char, char_information in file_chars.items():
            if not overwrite_all and char in existing_chars_set:
                print(f"Character '{char}' already exists, skipping...")
                continue
            if char_doc["jlpt_new"] is None:
                print("Character '{char}' has no jlpt_new value, skipping")
                continue
            char_doc = char_information
            char_doc["difficulty"] = 6 - char_doc["jlpt_new"]
            char_doc["content"] = char,
            char_doc["is_premium"] = False,
            char_doc["created_at"] = datetime.datetime.now(datetime.timezone.utc),
            char_doc["language"] = "jp"
            new_characters.append(char_doc)
        print(f"Prepared {len(new_characters)}")

        successful, failed = batch_insert(db, new_characters)
        # Summary
        print(f"\n📊 Character seeding summary:")
        print(f"   • Successfully added: {successful}")
        print(f"   • Failed: {failed}")
        if not overwrite_all:
            print(f"   • Already existed: {len(existing_chars_set)}")
        print(f"   • Total in database: {successful + (0 if overwrite_all else len(existing_chars_set))}")

    except Exception as e:
        print(f"Error in seed_character_table_jp: {e}")
        raise

def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        '--overwrite-all',
        action='store_true',
        help='If set, overwrite all characters in database (default: False)',
    )
    parser.add_argument('premium_level_start', type=int, help='Premium level start (integer)')

    args = parser.parse_args()
    overwrite_all = args.overwrite_all
    premium_level_start = args.premium_level_start
    print("🌱 Starting Firebase ...")

    db = initialize_firebase()
    if not db:
        print('Cannot initialize database')
        return

    if overwrite_all:
        delete_table(db, "characters")

    print("Inserting Chinese characters")
    seed_character_table_ch(db, int(premium_level_start), overwrite_all)
    print("Inserting Japanese characters")
    seed_character_table_jp(db, overwrite_all)

    print(f"\n🎉 Data seeding completed!")
    

if __name__ == "__main__":
    main()