import React from 'react';
import styles from './FlowStepper.module.css';

interface FlowStepperProps {
  currentStep: number;
}

const STEPS = ['Plan', 'Nominate', 'Train', 'Score'];

export const FlowStepper: React.FC<FlowStepperProps> = ({ currentStep }) => {
  return (
    <div className={styles.stepper} aria-label="Training pipeline progress">
      {STEPS.map((label, index) => {
        const state = index < currentStep ? 'completed' : index === currentStep ? 'current' : 'pending';
        return (
          <div 
            key={label}
            className={`${styles.step} ${styles[state]}`}
          >
            <div className={styles.stepContent}>
              <span className={styles.index}>{index + 1}</span>
              <span className={styles.label}>{label}</span>
            </div>
            {index < STEPS.length - 1 && <div className={styles.chevron} />}
          </div>
        );
      })}
    </div>
  );
};

