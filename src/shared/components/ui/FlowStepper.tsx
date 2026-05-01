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
        const state =
          index < currentStep ? 'completed' : index === currentStep ? 'current' : 'pending';
        return (
          <React.Fragment key={label}>
            <div className={styles.step}>
              <span
                className={`${styles.node} ${
                  state === 'completed'
                    ? styles.completedNode
                    : state === 'current'
                    ? styles.currentNode
                    : styles.pendingNode
                }`}
              >
                {state === 'completed' ? '✓' : index + 1}
              </span>
              <span
                className={`${styles.label} ${
                  state === 'completed'
                    ? styles.completedLabel
                    : state === 'current'
                    ? styles.currentLabel
                    : styles.pendingLabel
                }`}
              >
                {label}
              </span>
            </div>
            {index < STEPS.length - 1 && <span className={styles.connector} />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

