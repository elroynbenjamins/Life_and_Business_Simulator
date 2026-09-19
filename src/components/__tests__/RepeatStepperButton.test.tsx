import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import RepeatStepperButton from '../RepeatStepperButton';

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => (() => void)) => require('react').useEffect(callback, [callback]),
}));

describe('hold-to-repeat share controls', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  test('a quick tap adds exactly one', () => {
    const step = jest.fn();
    const view = render(<RepeatStepperButton onStep={step} accessibilityLabel="Increase shares"><Text>+</Text></RepeatStepperButton>);
    fireEvent.press(view.getByLabelText('Increase shares'));
    expect(step).toHaveBeenCalledTimes(1);
    expect(step).toHaveBeenCalledWith(1);
    view.unmount();
  });
  test('holding accelerates and release stops without an extra step', () => {
    const step = jest.fn();
    const view = render(<RepeatStepperButton onStep={step} accessibilityLabel="Increase shares"><Text>+</Text></RepeatStepperButton>);
    const button = view.getByLabelText('Increase shares');
    fireEvent(button, 'pressIn');
    fireEvent(button, 'longPress');
    act(() => jest.advanceTimersByTime(3000));
    expect(step).toHaveBeenCalledWith(5);
    expect(step).toHaveBeenCalledWith(25);
    fireEvent(button, 'pressOut');
    const count = step.mock.calls.length;
    fireEvent.press(button);
    act(() => jest.advanceTimersByTime(1000));
    expect(step).toHaveBeenCalledTimes(count);
    view.unmount();
  });
  test('unmounting cancels repeat', () => {
    const step = jest.fn();
    const view = render(<RepeatStepperButton onStep={step} accessibilityLabel="Increase shares"><Text>+</Text></RepeatStepperButton>);
    fireEvent(view.getByLabelText('Increase shares'), 'longPress');
    view.unmount();
    const count = step.mock.calls.length;
    act(() => jest.advanceTimersByTime(1000));
    expect(step).toHaveBeenCalledTimes(count);
  });
});
