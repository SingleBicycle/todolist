import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { getCurrentUser } from "../firebase/auth";
import { getUserById } from "../firebase/database";
import anonymousPfp from "/src/assets/anonymous-pfp-40x40.png";

const ProfileEditPage = () => {
  const navigate = useNavigate();
  const { uid } = useParams();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setIsLoading(true);
        const fetchedUser = await getUserById(uid);
        setUser(fetchedUser);
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
          Loading profile edit page...
        </h3>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-[var(--text)] mt-8">
        <h3 className="text-2xl font-bold text-center mb-20">
          Error loading profile edit page: {error.message}
        </h3>
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="text-[var(--text)] mt-8">
        <h3 className="text-2xl font-bold text-center mb-20">
          Profile edit page not found for uid: {uid}
        </h3>
      </div>
    );
  }

  // Users state
  return (
    <div className="text-[var(--text)] mt-8">
      <h3 className="text-2xl font-bold text-center mb-20">
        Profile edit page
      </h3>

    
    </div>
  );
};

export default ProfileEditPage;
