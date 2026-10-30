import React from 'react';

interface GlobalLoaderProps {
  show: boolean;
  title: string;
  text: string;
}

export const GlobalLoader: React.FC<GlobalLoaderProps> = ({ show, title, text }) => {
  if (!show) return null;

  return (
    <div id="globalLoader" className="global-loader" aria-live="polite" aria-busy="true">
      <div className="loader-card">
        <div className="loader-spinner"></div>
        <div id="loaderTitle" className="loader-title">{title}</div>
        <div id="loaderText" className="loader-text">{text}</div>
        <div className="loader-progress">
          <span></span>
        </div>
      </div>
    </div>
  );
};
