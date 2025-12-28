
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, title, description, className = '' }) => {
  return (
    <div className={`glass rounded-2xl overflow-hidden p-6 ${className}`}>
      {(title || description) && (
        <div className="mb-6">
          {title && <h3 className="text-xl font-bold text-white">{title}</h3>}
          {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;
