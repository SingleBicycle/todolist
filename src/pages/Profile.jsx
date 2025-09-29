import React, { useState, useEffect } from 'react';
import { getCurrentUser } from "../firebase/auth";

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

  // Users state
  return (
    <div className="text-[var(--text)] mt-8">
      <h3 className="text-2xl font-bold text-center mb-20">
        I am: {currentUser.id}
      </h3>
    </div>
  );
};

export default ProfilePage;
