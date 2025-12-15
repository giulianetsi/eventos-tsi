import React from 'react';
import './Button.css';

const Button = ({ as: Component = 'button', children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const classes = `app-btn app-btn--${variant} app-btn--${size} ${className}`.trim();

  if (Component === 'button') {
    return (
      <button className={classes} {...props}>
        {children}
      </button>
    );
  }

  const Comp = Component;
  return (
    <Comp className={classes} {...props}>
      {children}
    </Comp>
  );
};

export default Button;
