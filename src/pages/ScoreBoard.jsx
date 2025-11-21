import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAllUsers } from "../firebase/database";
import { getCurrentUser } from "../firebase/auth";
import anonymousPfp from "/src/assets/anonymous-pfp-40x40.png";
import { formatRelativeTime } from "../utils/time";

const ScoreBoardPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [fetchedCurrentUser, fetchedUsers] = await Promise.all([
          getCurrentUser(),
          getAllUsers(),
        ]);
        const sortedUsers = fetchedUsers.sort((a, b) => {
          const pointsA = a.points || 0;
          const pointsB = b.points || 0;

          if (pointsA !== pointsB) {
            return pointsB - pointsA;
          }

          return new Date(a.created_at) - new Date(b.created_at);
        });
        setUsers(sortedUsers);
        setCurrentUser(fetchedCurrentUser);
        setIsLoading(false);
      } catch (err) {
        setError(err);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center text-[var(--text)] mt-4 sm:mt-8 px-4">
        <h3 className="text-xl sm:text-2xl font-bold text-center mb-10 sm:mb-20">
          Loading scoreboard...
        </h3>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-[var(--text)] mt-4 sm:mt-8 px-4">
        <h3 className="text-xl sm:text-2xl font-bold text-center mb-10 sm:mb-20">
          Error loading scoreboard: {error.message}
        </h3>
      </div>
    );
  }

  // Users state
  return (
    <div className="text-[var(--text)] px-4">
      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mt-8 sm:mt-12 lg:mt-20 mb-4 sm:mb-6 lg:mb-8">
        Scoreboard
      </h2>
      <div className="flex flex-col items-center justify-center">
        <div className="w-full max-w-4xl bg-[var(--tertiary)] rounded-md my-2 sm:m-4 overflow-hidden">
          <table className="w-full table-fixed">
            <thead className="bg-[var(--primary)] text-white">
              <tr>
                <th className="py-3 px-2 sm:px-4 text-xs sm:text-base w-12 sm:w-16">
                  Rank
                </th>
                <th className="py-3 px-2 sm:px-4 text-left text-xs sm:text-base">
                  Username
                </th>
                <th className="py-3 px-2 sm:px-4 text-xs sm:text-base hidden md:table-cell">
                  Last played at
                </th>
                <th className="py-3 px-2 sm:px-4 text-xs sm:text-base w-16 sm:w-20">
                  Points
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr
                  key={user.id}
                  className={`cursor-pointer ${
                    currentUser && user.id === currentUser.uid
                      ? "bg-[var(--accent-secondary)] hover:bg-[var(--secondary)] transition-all duration-200 ease-in-out"
                      : "bg-[var(--tertiary)] hover:bg-[var(--secondary)] transition-all duration-200 ease-in-out"
                  }`}
                  onClick={() => {
                    navigate(`/profile/${user.id}`);
                  }}
                >
                  <td className="py-3 px-2 sm:px-4 text-center text-xs sm:text-base">
                    {index + 1}
                  </td>
                  <td className="py-3 px-2 sm:px-4">
                    <div className="flex flex-row items-center min-w-0">
                      <img
                        className="size-6 sm:size-8 rounded-sm mr-1 sm:mr-2 flex-shrink-0 object-cover"
                        src={user.photo_url || anonymousPfp}
                        alt="Profile image"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-xs sm:text-base truncate">
                        {user.username || "No username"}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-2 sm:px-4 text-center text-xs sm:text-base hidden md:table-cell">
                    {formatRelativeTime(user.last_played_at) || "Never"}
                  </td>
                  <td className="py-3 px-2 sm:px-4 text-center text-xs sm:text-base font-semibold">
                    {user.points || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ScoreBoardPage;
