import React, { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
} from "react-router-dom";
import { getAllUsers } from "../firebase/database";
import { getCurrentUser } from "../firebase/auth";
import BackButton from "./BackButton";
import anonymousPfp from "/src/assets/anonymous-pfp-40x40.png";

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

        // Sort users by score in descending order
        const sortedUsers = fetchedUsers.sort(
          (a, b) => (b.points || 0) - (a.points || 0)
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
      <div className="flex flex-col items-center justify-center text-[var(--text)] mt-8">
        <h3 className="text-2xl font-bold text-center mb-20">
          Loading scoreboard...
        </h3>
        {/* <BackButton /> */}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-[var(--text)] mt-8">
        <h3 className="text-2xl font-bold text-center mb-20">
          Error loading scoreboard: {error.message}
        </h3>
        {/* <BackButton /> */}
      </div>
    );
  }

  // Users state
  return (
    <div className="text-[var(--text)]">
      <h2 className="text-4xl font-bold text-center mt-20 mb-8">Scoreboard</h2>

      <div className="flex flex-col items-center justify-center">
        <div className="w-80/100 bg-[var(--tertiary)] rounded-md m-4">
          <table className="w-full">
            <thead className="bg-[var(--primary)] text-white">
              <tr>
                <th>Rank</th>
                <th>Username</th>
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
                      ? "bg-[var(--accent-secondary)] hover:bg-[var(--accent-primary)] transition-all duration-200 ease-in-out"
                      : "bg-[var(--tertiary)] hover:bg-[var(--secondary)] transition-all duration-200 ease-in-out"
                  }
                  cursor-pointer
                  onClick={() => {
                    navigate(`/profile/${user.id}`);
                  }}
                >
                  <td>{index + 1}</td>
                  <td className="flex flex-row items-center">
                    <img
                      className="size-8 rounded-sm mr-2"
                      src={user.photo_url || anonymousPfp}
                      alt="Profile image"
                      referrerPolicy="no-referrer"
                    />{" "}
                    {user.username || "No username"}
                  </td>
                  <td>{user.last_played_at || "Never"}</td>
                  <td>{user.points || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* <BackButton /> */}
      </div>
    </div>
  );
};

export default ScoreBoardPage;
