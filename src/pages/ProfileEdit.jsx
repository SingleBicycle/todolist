import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getCurrentUser } from "../firebase/auth";
import { getUserById, updateUser } from "../firebase/database";
import anonymousPfp from "/src/assets/anonymous-pfp-40x40.png";

const ProfileEditPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { uid } = useParams();
  const [formData, setFormData] = useState({
    username: "",
    first_name: "",
    last_name: "",
  });
  const [user, setUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const isFirstTimeSignIn = location.state?.firstTimeSignIn || false;

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        const fetchedUser = await getUserById(uid);
        setUser(fetchedUser);
        const currentUser = await getCurrentUser();
        setCurrentUser(currentUser);

        setFormData({
          username: fetchedUser.username || '',
          first_name: fetchedUser.first_name || '',
          last_name: fetchedUser.last_name || '',
        });

        
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('Failed to load user data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [uid]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Validate form data
      if (!formData.username) {
        setError('Display name is required');
        return;
      }

      // Remove empty fields to avoid overwriting with empty strings
      const cleanedData = Object.fromEntries(
        Object.entries(formData).filter(([_, v]) => v !== '')
      );

      // Call the update function
      await updateUser(uid, cleanedData);

      // Navigate back to profile or show success message
      if (isFirstTimeSignIn) {
        navigate("/play")
      } else {
        navigate(`/profile/${uid}`);
      }
    } catch (err) {
      console.error('Update failed:', err);
      setError('Failed to update profile');
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center text-[var(--text)] mt-8">
        <h3 className="text-2xl font-bold text-center mb-20">
          Loading profile edit page...
        </h3>
        <button
          type="button"
          className="blue-button ml-8"
          onClick={() => navigate(`/profile/${uid}`)}
        >
          Back to profile
        </button>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-[var(--text)] mt-8">
        <h3 className="text-2xl font-bold text-center mb-20">
          Error loading profile edit page: {error.message}
        </h3>
        <button
          type="button"
          className="blue-button ml-8"
          onClick={() => navigate(`/profile/${uid}`)}
        >
          Back to profile
        </button>
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="flex flex-col items-center justify-center text-[var(--text)] mt-8">
        <h3 className="text-2xl font-bold text-center mb-20">
          Profile edit page not found for uid: {uid}
        </h3>
        <button
          type="button"
          className="blue-button ml-8"
          onClick={() => navigate(`/profile/${uid}`)}
        >
          Back to profile
        </button>
      </div>
    );
  }

  if (currentUser.uid == uid) {
    return (
      <div className="flex flex-col items-center justify-center text-[var(--text)] mt-8">
        <h3 className="text-2xl font-bold text-center mb-20">
          You can only edit your own profile!
        </h3>
        <button
          type="button"
          className="blue-button ml-8"
          onClick={() => navigate(`/profile/${uid}`)}
        >
          Back to profile
        </button>
      </div>
    );
  }

  // Users state
  return (
    <div className="text-[var(--text)] mt-8">
      <h3 className="flex items-center justify-center text-2xl font-bold text-center mb-20">
        {isFirstTimeSignIn && (
          <div className="w-80/100 center place-content-center p-8 bg-[var(--tertiary)]">
            Please complete your profile to get started!
          </div>
        )}
        {!isFirstTimeSignIn && (
          <div>
            Edit profile
          </div>
        )}
        
      </h3>

      <div className="flex flex-col items-center justify-center">
        <div className="w-80/100 bg-[var(--tertiary)] rounded-md">

          
            <form onSubmit={handleSubmit} className="p-8 flex flex-col items-center justify-center">
            <div className="form-group">
              <label htmlFor="username" className="form-label">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                placeholder="Enter your username"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="first_name" className="form-label">First name</label>
              <input
                type="first_name"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                placeholder="Enter your first name"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="last_name" className="form-label">Last name</label>
              <input
                type="last_name"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                placeholder="Enter your last name"
                className="form-input"
              />
            </div>

            <div className="p-8 flex flex-row items-center justify-center">
              <button
                type="button"
                className="blue-button ml-8"
                onClick={() => navigate(`/profile/${uid}`)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="blue-button ml-8"
                disabled={isLoading}
              >
                {isLoading ? 'Updating...' : 'Save Changes'}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};

export default ProfileEditPage;
