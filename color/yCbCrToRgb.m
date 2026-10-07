function I = yCbCrToRgb(Y)
%YCBCRTORGB Inverse of rgbToYCbCr.
M = [65.481 128.553 24.966; -37.797 -74.203 112; 112 -93.786 -18.214] / 255;
offset = [16; 128; 128] / 255;
I = reshape((reshape(Y, [], 3) - offset') / M', size(Y));
I = min(max(I, 0), 1);
end
