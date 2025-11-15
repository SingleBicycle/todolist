import { useEffect, useRef, useState } from "react";
import { 
    getAllCharacters, 
    getDifficultyCharacter
} from "../firebase/database";
import { getCurrentUser } from "./Login";

const DictionaryPage = () => {
  const [characters, setCharacters] = useState([]);
  const [filteredCharacters, setFilteredCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [charactersData, currentUser] = await Promise.all([
          getAllCharacters(),
          getCurrentUser()
        ]);
        setCharacters(charactersData);
        setFilteredCharacters(charactersData);
        setUser(currentUser);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filterByDifficulty = async (difficulty) => {
    setSelectedDifficulty(difficulty);
    setLoading(true);
    try {
      if (difficulty === 'all') {
        const allChars = await getAllCharacters();
        setFilteredCharacters(allChars);
      } else {
        const filtered = await getDifficultyCharacter(parseInt(difficulty));
        setFilteredCharacters(filtered);
      }
    } catch (error) {
      console.error("Error filtering characters:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-center mb-8" style={{ color: 'var(--text)' }}>
          Dictionary
        </h1>

        {/* Filter and Sort Controls */}
        <div className="max-w-4xl mx-auto mb-4 flex justify-start items-center">
          <div className="flex items-center gap-4">
            <label className="font-semibold" style={{ color: 'var(--text)' }}>
              Filter by Difficulty:
            </label>
            <select
              value={selectedDifficulty}
              onChange={(e) => filterByDifficulty(e.target.value)}
              className="px-4 py-2 border-2 rounded-lg"
              style={{ 
                borderColor: 'var(--primary)',
                color: 'var(--text)'
              }}
            >
              <option value="all">All Difficulties</option>
              <option value="1">Difficulty 1</option>
              <option value="2">Difficulty 2</option>
              <option value="3">Difficulty 3</option>
              <option value="4">Difficulty 4</option>
              <option value="5">Difficulty 5</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading characters...</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-3 bg-[var(--primary)] text-white border-b-2 border-gray-300">
              <div className="px-6 py-4 font-semibold">
                Character
              </div>
              <div className="px-6 py-4 font-semibold">
                Difficulty
              </div>
              <div className="px-6 py-4 font-semibold">
                Definition
              </div>
            </div>

            {/* Table Body */}
            <div>
              {filteredCharacters.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  No characters found
                </div>
              ) : (
                filteredCharacters.map((char, index) => (
                  <div
                    key={char.id}
                    className="grid grid-cols-3 hover:bg-gray-50 transition-colors"
                    style={{ backgroundColor: index % 2 === 0 ? 'var(--tertiary)' : 'white' }}
                  >
                    <div className="px-6 py-4 text-2xl text-black">
                      {char.content}
                    </div>
                    <div className="px-6 py-4 text-black">
                      Level {char.difficulty}
                    </div>
                    <div className="px-6 py-4 text-black">
                      {char.meanings.join("; ")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DictionaryPage;