import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { getCurrentUser } from "../firebase/auth";
import { getUserById } from "../firebase/database";
import anonymousPfp from "/src/assets/anonymous-pfp-40x40.png";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { uid } = useParams();
  const [user, setUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setIsLoading(true);
        const fetchedUser = await getUserById(uid);
        setUser(fetchedUser);
        const currentUser = await getCurrentUser();
        setCurrentUser(currentUser);
        setIsLoading(false);
      } catch (err) {
        setError(err);
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="text-[var(--text)] mt-8">
        <h3 className="text-2xl font-bold text-center mb-20">
          Loading profile...
        </h3>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-[var(--text)] mt-8">
        <h3 className="text-2xl font-bold text-center mb-20">
          Error loading profile: {error.message}
        </h3>
      </div>
    );
  }

if (user === null) {
  return (
    <div className="text-[var(--text)] mt-8">
      <h3 className="text-2xl font-bold text-center mb-20">
        Profile not found for uid: {uid}
      </h3>
    </div>
  );
}

  // Users state
  return (
    <div className="text-[var(--text)] mt-8">
      <h3 className="text-2xl font-bold text-center mb-20">
        Profile Page
      </h3>

      <div className="flex flex-col items-center justify-center">
        <div className="w-80/100 bg-[var(--tertiary)] rounded-md">

          <div className="p-12 flex flex-row items-center justify-between">
            <div className="flex flex-row items-center">
              <img
                className="pr-8"
                src={user.photo_url}
                alt="Profile image"
                referrerPolicy="no-referrer"
              />
              <h2 className="text-4xl font-bold">
                {user.username || "No username"}
              </h2>
            </div>
            {currentUser.uid == uid && <button
              className="ml-8 bg-[var(--primary)] text-white shadow-md hover:bg-[var(--accent-primary)] transition-all duration-200 ease-in-out"
              onClick={() => {
                navigate(`/profile/${uid}/edit`)
              }}
            >
              Edit profile
            </button>
            }

          </div>

          

          <div className="p-12">
            <table>
              <tbody>
                <tr>
                  <td>First name</td>
                  <td>{user.first_name}</td>
                </tr>
                <tr>
                  <td>Last name</td>
                  <td>{user.last_name}</td>
                </tr>
                <tr>
                  <td>Email</td>
                  <td>{user.email}</td>
                </tr>
                <tr>
                  <td>UID</td>
                  <td>{uid}</td>
                </tr>
                <tr>
                  <td>Created at</td>
                  <td>{user.created_at}</td>
                </tr>
                <tr>
                  <td>Is admin</td>
                  <td>{user.is_admin}</td>
                </tr>
                <tr>
                  <td>Is on random mode</td>
                  <td>{user.is_on_random_mode}</td>
                </tr>
                <tr>
                  <td>Last played at</td>
                  <td>{user.last_played_at}</td>
                </tr>
                <tr>
                  <td>Last word</td>
                  <td>{user.last_word}</td>
                </tr>
                <tr>
                  <td>Points</td>
                  <td>{user.points}</td>
                </tr>
              </tbody>
            </table>

          </div>

        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
