import firebase_admin
import datetime
import sys
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

def seed_character_table_ch(db, characters_by_difficulty, premium_level_start = 4, overwrite_all = False):
    try:
        if overwrite_all:
            delete_table(db, "characters")

        new_characters = []
        existing_chars_set = set()
        
        if not overwrite_all:
            print("🔍 Checking for existing characters...")
            existing_chars_query = db.collection("characters").select(["content"]).get()
            existing_chars_set = {doc.get("content") for doc in existing_chars_query if doc.get("language") == "ch"}
            print(f"ℹ️ Found {len(existing_chars_set)} existing characters")
        
        for diff, chars in characters_by_difficulty.items():
            difficulty_count = 0
            
            for _, ch in enumerate(chars):
                # Skip if character already exists (unless overwriting)
                if not overwrite_all and ch in existing_chars_set:
                    print(f"⏭️ Character '{ch}' already exists, skipping...")
                    continue
                
                char_doc = {
                    "difficulty": diff,
                    "content": ch,
                    "is_premium": diff >= premium_level_start,
                    "created_at": datetime.datetime.now(datetime.timezone.utc),
                    "language": "ch"
                }
                
                new_characters.append(char_doc)
                difficulty_count += 1
            
                print(f"📋 Prepared {difficulty_count} characters for difficulty level {diff}")
        
        successful, failed = batch_insert(db, new_characters)
        
        # Summary
        print(f"\n📊 Character seeding summary:")
        print(f"   • Successfully added: {successful}")
        print(f"   • Failed: {failed}")
        if not overwrite_all:
            print(f"   • Already existed: {len(existing_chars_set)}")
        print(f"   • Total in database: {successful + (0 if overwrite_all else len(existing_chars_set))}")
        
    except Exception as e:
        print(f"❌ Error in seed_character_table_ch: {e}")
        raise

def seed_character_table_jp(db, overwrite_all = False):
    try:
        if overwrite_all:
            delete_table(db, "characters")

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
            char_doc = char_information
            char_doc["difficulty"] = char_doc["jlpt_new"]
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
    print("🌱 Starting Firebase ...")

    db = initialize_firebase()
    if not db:
        print('Cannot initialize database')
        return
    
    overwrite_all, premium_level_start = sys.argv[1], sys.argv[2]

    characters_by_difficulty_ch = {
        1: list("一二三四五六七八九十大小山水火木金土日月人口手足心目耳鼻头身女男田米禾竹石云"),
        2: list("我你他她们这那时间学校老师学生朋友家爸妈哥姐弟妹工作生活来去吃喝看听说读写"),
        3: list("朋友学习校老师同家庭国孩子教作时间生活世界父母兄弟姐妹高兴说话读书写字"),
        4: list("电脑话视图书音乐影问题社会历文化语言科学艺术新闻网络信息游戏运动健康旅游"),
        5: list("经济发展环境教育政治法律哲学心理文学数理化学生物技术国际全球未来知识创新研究")
    }
    print("Inserting Chinese characters")
    seed_character_table_ch(db, characters_by_difficulty_ch, int(premium_level_start), overwrite_all == "1")
    print("Inserting Japanese characters")
    seed_character_table_jp(db, overwrite_all)

    print(f"\n🎉 Data seeding completed!")
    

if __name__ == "__main__":
    main()