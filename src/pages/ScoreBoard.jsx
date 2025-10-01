import React, { useState, useEffect } from 'react';
import { getAllUsers } from '../firebase/database';
import { getCurrentUser } from "../firebase/auth";

const ScoreBoardPage = () => {
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
          getAllUsers()
        ]);

        // Sort users by score in descending order
        const sortedUsers = fetchedUsers.sort((a, b) =>
          (b.points || 0) - (a.points || 0)
        );

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
      <div className="text-[var(--text)] mt-8">
        <h3 className="text-2xl font-bold text-center mb-20">
          Loading scoreboard...
        </h3>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-[var(--text)] mt-8">
        <h3 className="text-2xl font-bold text-center mb-20">
          Error loading scoreboard: {error.message}
        </h3>
      </div>
    );
  }

  // Users state
  return (
    <div className="text-[var(--text)]">
      <h2 className="text-4xl font-bold text-center mt-20 mb-8">
        Scoreboard
      </h2>

      <div className="flex flex-col items-center justify-center">
        <div className="w-80/100 bg-[var(--tertiary)] rounded-md">
          <table className="w-full">
            <thead className="bg-[var(--primary)] text-white">
              <tr>
                <th>Rank</th>
                <th>First name</th>
                <th>Last name</th>
                <th>Last played at</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr 
                  key={user.id} 
                  className={
                    currentUser && user.id === currentUser.uid
                      ? "bg-[var(--accent-secondary)]"
                      : ""
                }>
                  <td>{index + 1}</td>
                  <td>{user.first_name}</td>
                  <td>{user.last_name}</td>
                  <td>{user.last_played_at || "Never"}</td>
                  <td>{user.points || 0}</td>
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
