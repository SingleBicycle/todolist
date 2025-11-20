import React, { useState, useEffect } from "react";
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
      <div className="text-[var(--text)] mt-8 px-4">
        <h3 className="text-xl sm:text-2xl font-bold text-center mb-20">
          Loading profile...
        </h3>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-[var(--text)] mt-8 px-4">
        <h3 className="text-xl sm:text-2xl font-bold text-center mb-20">
          Error loading profile: {error.message}
        </h3>
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="text-[var(--text)] mt-8 px-4">
        <h3 className="text-xl sm:text-2xl font-bold text-center mb-20">
          Profile not found for uid: {uid}
        </h3>
      </div>
    );
  }

  // Users state
  return (
    <div className="text-[var(--text)] mt-4 sm:mt-8 px-4">
      <h3 className="text-xl sm:text-2xl font-bold text-center mb-8 sm:mb-20">Profile Page</h3>

      <div className="flex flex-col items-center justify-center">
        <div className="w-full max-w-4xl bg-[var(--tertiary)] rounded-md mx-4 my-2 sm:m-4">
          <div className="p-4 sm:p-8 lg:p-12 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <img
                className="w-16 h-16 sm:w-20 sm:h-20 object-cover"
                src={user.photo_url || anonymousPfp}
                alt="Profile image"
                referrerPolicy="no-referrer"
              />
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center sm:text-left break-words max-w-full">
                {user.username || "No username"}
              </h2>
            </div>
            {currentUser.uid == uid && (
              <button
                className="blue-button sm:ml-8 w-full sm:w-auto whitespace-nowrap"
                onClick={() => {
                  navigate(`/profile/${uid}/edit`);
                }}
              >
                Edit profile
              </button>
            )}
          </div>

          <div className="p-4 sm:p-8 lg:p-12 overflow-x-auto">
            <table className="w-full">
              <tbody>
                {/* <tr>
                  <td><b>First name</b></td>
                  <td>{user.first_name}</td>
                </tr>
                <tr>
                  <td><b>Last name</b></td>
                  <td>{user.last_name}</td>
                </tr>
                <tr>
                  <td><b>Email</b></td>
                  <td>{user.email}</td>
                </tr>
                <tr>
                  <td><b>UID</b></td>
                  <td>{uid}</td>
                </tr> */}
                <tr className="border-b border-gray-200">
                  <td className="py-3 pr-4 text-sm sm:text-base">
                    <b>Created at</b>
                  </td>
                  <td className="py-3 text-sm sm:text-base break-words">{user.created_at}</td>
                </tr>
                {/* <tr>
                  <td>Is admin</td>
                  <td>{user.is_admin}</td>
                </tr>
                <tr>
                  <td>Is on random mode</td>
                  <td>{user.is_on_random_mode}</td>
                </tr> */}
                <tr className="border-b border-gray-200">
                  <td className="py-3 pr-4 text-sm sm:text-base">
                    <b>Last played at</b>
                  </td>
                  <td className="py-3 text-sm sm:text-base break-words">{user.last_played_at}</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-3 pr-4 text-sm sm:text-base">
                    <b>Last word</b>
                  </td>
                  <td className="py-3 text-sm sm:text-base">{user.last_word}</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-3 pr-4 text-sm sm:text-base">
                    <b>Points</b>
                  </td>
                  <td className="py-3 text-sm sm:text-base">{user.points}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-sm sm:text-base">
                    <b>Language</b>
                  </td>
                  <td className="py-3 text-sm sm:text-base">{user.language}</td>
                </tr>
                <tr>
                  <td>
                    <b>Language</b>
                  </td>
                  <td>{user.language}</td>
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