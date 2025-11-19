import { useEffect, useRef, useState } from "react";
import { 
    getAllCharacters, 
    getDifficultyCharacter
} from "../firebase/database";
import { getCurrentUser } from "./Login";

function DifficultyText(props) {
  const difficulty = props.difficulty;
  const language = props.language;
  if (language == "ch") {
    return "HSK " + difficulty;
  }
  return "JLPT N" + difficulty;
}

const DictionaryPage = () => {
  const [characters, setCharacters] = useState([]);
  const [filteredCharacters, setFilteredCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState(1);

  useEffect(() => {
    filterByDifficulty(selectedDifficulty);
  }, []);

  const filterByDifficulty = async (difficulty) => {
    setSelectedDifficulty(difficulty);
    setLoading(true);
    try {
      if (difficulty >= 1 && difficulty <= 6) {
        const filtered = await getDifficultyCharacter(parseInt(difficulty), "chinese");
        setFilteredCharacters(filtered);
      } else {
        const filtered = await getDifficultyCharacter(parseInt(difficulty - 6), "japanese");
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
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-6 sm:mb-8" style={{ color: 'var(--text)' }}>
          Dictionary
        </h1>

        {/* Filter and Sort Controls */}
        <div className="max-w-4xl mx-auto mb-4 flex flex-col sm:flex-row justify-start items-start sm:items-center gap-2 sm:gap-4">
          <label className="font-semibold text-sm sm:text-base" style={{ color: 'var(--text)' }}>
            Filter by Difficulty:
          </label>
          <select
            value={selectedDifficulty}
            onChange={(e) => filterByDifficulty(e.target.value)}
            className="w-full sm:w-auto px-3 sm:px-4 py-2 border-2 rounded-lg text-sm sm:text-base"
            style={{ 
              borderColor: 'var(--primary)',
              color: 'var(--text)'
            }}
          >
            <optgroup label="Chinese">
              <option value="1">HSK 1</option>
              <option value="2">HSK 2</option>
              <option value="3">HSK 3</option>
              <option value="4">HSK 4</option>
              <option value="5">HSK 5</option>
              <option value="6">HSK 6</option>
            </optgroup>
            <optgroup label="Japanese">
              <option value="7">JLPT N1</option>
              <option value="8">JLPT N2</option>
              <option value="9">JLPT N3</option>
              <option value="10">JLPT N4</option>
              <option value="11">JLPT N5</option>
            </optgroup>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-sm sm:text-base">Loading characters...</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Table Header - Hidden on mobile, shown on tablet+ */}
            <div className="hidden md:grid grid-cols-3 bg-[var(--primary)] text-white border-b-2 border-gray-300">
              <div className="px-4 lg:px-6 py-3 lg:py-4 font-semibold text-sm lg:text-base">
                Character
              </div>
              <div className="px-4 lg:px-6 py-3 lg:py-4 font-semibold text-sm lg:text-base">
                Difficulty
              </div>
              <div className="px-4 lg:px-6 py-3 lg:py-4 font-semibold text-sm lg:text-base">
                Definition
              </div>
            </div>

            {/* Table Body */}
            <div>
              {filteredCharacters.length === 0 ? (
                <div className="px-4 sm:px-6 py-8 text-center text-gray-500 text-sm sm:text-base">
                  No characters found
                </div>
              ) : (
                filteredCharacters.map((char, index) => (
                  <div
                    key={char.id}
                    className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors"
                    style={{ backgroundColor: index % 2 === 0 ? 'var(--tertiary)' : 'white' }}
                  >
                    {/* Mobile Layout - Stack vertically */}
                    <div className="md:hidden px-4 py-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-3xl text-black font-bold">
                          {char.content}
                        </div>
                        <div className="text-xs bg-[var(--primary)] text-white px-2 py-1 rounded-full whitespace-nowrap ml-2">
                          <DifficultyText difficulty={char.difficulty} language={char.language} />
                        </div>
                      </div>
                      <div className="text-sm text-black">
                        {char.meanings.join("; ")}
                      </div>
                    </div>

                    {/* Desktop Layout - Grid */}
                    <div className="hidden md:grid grid-cols-3">
                      <div className="px-4 lg:px-6 py-3 lg:py-4 text-xl lg:text-2xl text-black">
                        {char.content}
                      </div>
                      <div className="px-4 lg:px-6 py-3 lg:py-4 text-sm lg:text-base text-black">
                        <DifficultyText difficulty={char.difficulty} language={char.language} />
                      </div>
                      <div className="px-4 lg:px-6 py-3 lg:py-4 text-sm lg:text-base text-black">
                        {char.meanings.join("; ")}
                      </div>
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