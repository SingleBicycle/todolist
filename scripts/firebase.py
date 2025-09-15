import firebase_admin
import datetime
import sys
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

def seed_character_table(db, characters_by_difficulty, premium_level_start = 4, overwrite_all = False):
    successful, failed = 0, 0
    
    try:
        if overwrite_all:
            delete_table(db, "characters")

        new_characters = []
        existing_chars_set = set()
        
        if not overwrite_all:
            print("🔍 Checking for existing characters...")
            existing_chars_query = db.collection("characters").select(["content"]).get()
            existing_chars_set = {doc.get("content") for doc in existing_chars_query}
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
                    "created_at": datetime.datetime.now(datetime.timezone.utc)
                }
                
                new_characters.append(char_doc)
                difficulty_count += 1
            
                print(f"📋 Prepared {difficulty_count} characters for difficulty level {diff}")
        
        # Insert new characters in batches
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
        
        # Summary
        print(f"\n📊 Character seeding summary:")
        print(f"   • Successfully added: {successful}")
        print(f"   • Failed: {failed}")
        if not overwrite_all:
            print(f"   • Already existed: {len(existing_chars_set)}")
        print(f"   • Total in database: {successful + (0 if overwrite_all else len(existing_chars_set))}")
        
    except Exception as e:
        print(f"❌ Error in seed_character_table: {e}")
        raise

def main():
    print("🌱 Starting Firebase ...")

    db = initialize_firebase()
    if not db:
        print('Cannot initialize database')
        return
    
    overwrite_all, premium_level_start = sys.argv[1], sys.argv[2]

    characters_by_difficulty = {
        1: list("一二三四五六七八九十日月水火木金土山人大小中上下"),
        2: list("我你他她它我们你们他们她们这那哪什么的爱心手足口耳眼鼻头"),
        3: list("朋友学习学校老师同学家庭国家孩子工作时间生活世界中国"),
        4: list("电脑电话电视图书音乐电影问题社会历史文化语言科学艺术"),
        5: list("经济发展环境教育政治法律哲学心理学文学数学物理化学生物")
    }
    seed_character_table(db, characters_by_difficulty, int(premium_level_start), overwrite_all == "1")

    print(f"\n🎉 Data seeding completed!")
    

if __name__ == "__main__":
    main()