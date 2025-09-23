import React, { useState, useEffect } from 'react';
import { getAllUsers } from '../firebase/database';

const ScoreBoardPage = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        const fetchedUsers = await getAllUsers();

        // Sort users by score in descending order
        const sortedUsers = fetchedUsers.sort((a, b) =>
          (b.points || 0) - (a.points || 0)
        );

        setUsers(sortedUsers);
        setIsLoading(false);
      } catch (err) {
        setError(err);
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Loading state
  if (isLoading) {
    return <div className="text-[var(--text)]">Loading scoreboard...</div>;
  }

  // Error state
  if (error) {
    return <div className="text-[var(--text)]">Error loading scoreboard: {error.message}</div>;
  }

  // Users state
  return (
    <div className="text-[var(--text)]">
      <h2 className="text-4xl font-bold text-center mb-12">
        Scoreboard
      </h2>

      <div className="flex flex-col items-center justify-center">
        <div className="w-80/100 bg-[var(--secondary)] rounded-md">
          <table className="w-full">
            <thead className="bg-[var(--primary)]">
              <tr>
                <th>First name</th>
                <th>Last name</th>
                <th>Last played at</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={user.id}>
                  <td>{user.first_name}</td>
                  <td>{user.last_name}</td>
                  <td>{user.last_played_at}</td>
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
