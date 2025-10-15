import React, { useState, useEffect } from 'react';
import { getCurrentUser } from "../firebase/auth";
import anonymousPfp from "/src/assets/anonymous-pfp-40x40.png";

const ProfilePage = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        setIsLoading(true);
        const fetchedCurrentUser = await getCurrentUser();
        setCurrentUser(fetchedCurrentUser);
        setIsLoading(false);
      } catch (err) {
        setError(err);
        setIsLoading(false);
      }
    };

    fetchCurrentUser();
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

if (currentUser === null) {
  return (
    <div className="text-[var(--text)] mt-8">
      <h3 className="text-2xl font-bold text-center mb-20">
        Anonymous user, no profile
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

          <div className="p-12 flex flex-row items-center">
            <img 
              className="pr-8"
              src={currentUser.photoURL}
              alt="Profile image" 
              referrerPolicy="no-referrer"
            />
            <h2 className="text-4xl font-bold">
              {currentUser.displayName}
            </h2>
          </div>
          

          <p className="p-12">
            <table>
              <tr>
                <td>Email</td>
                <td>{currentUser.email}</td>
              </tr>
                <td>UID</td>
                <td>{currentUser.uid}</td>
            </table>

          </p>

        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
