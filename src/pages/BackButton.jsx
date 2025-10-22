import React from 'react';
import { useNavigate } from 'react-router-dom';

const BackButton = ({
  className = "blue-button",
  children = "Back"
}) => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className={className}
      onClick={() => navigate(-1)}
    >
      {children}
    </button>
  );
};

export default BackButton;
