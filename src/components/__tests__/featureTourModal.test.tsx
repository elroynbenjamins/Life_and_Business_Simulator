import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import FeatureTourModal, { FeatureTourStep } from '../FeatureTourModal';

const steps: FeatureTourStep[] = [
  { title: 'Cash pools', body: 'Personal and company cash are separate.' },
  { title: 'Protected reserves', body: 'Protected cash stays in the company.' },
  { title: 'Preview', body: 'Review the transaction before confirming.' },
];

describe('FeatureTourModal', () => {
  it('stays manual, navigates through short lessons, and closes on Done', () => {
    const onClose = jest.fn();
    const { getByLabelText, getByText, queryByText } = render(
      <FeatureTourModal visible title="Business cash basics" steps={steps} onClose={onClose} />,
    );

    expect(getByText('Cash pools')).toBeTruthy();
    expect(queryByText('Protected reserves')).toBeNull();

    fireEvent.press(getByLabelText('Next tour step'));
    expect(getByText('Protected reserves')).toBeTruthy();

    fireEvent.press(getByLabelText('Next tour step'));
    expect(getByText('Preview')).toBeTruthy();

    fireEvent.press(getByLabelText('Finish tour'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('supports going back without changing game state or requiring persistence', () => {
    const onClose = jest.fn();
    const { getByLabelText, getByText } = render(
      <FeatureTourModal visible title="Holdings cash basics" steps={steps} onClose={onClose} />,
    );

    fireEvent.press(getByLabelText('Next tour step'));
    expect(getByText('Protected reserves')).toBeTruthy();

    fireEvent.press(getByLabelText('Previous tour step'));
    expect(getByText('Cash pools')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
