function J = applyToIntensity(fn, I)
%APPLYTOINTENSITY Apply an intensity transform without changing HSI hue or saturation.
%   For grayscale images fn is applied directly. For RGB images, fn is applied
%   to the HSI intensity channel before converting the result back to RGB.

I = toDouble(I);
if size(I, 3) == 3
    HSI = rgbToHsi(I);
    HSI(:,:,3) = min(max(fn(HSI(:,:,3)), 0), 1);
    J = hsiToRgb(HSI);
else
    J = fn(I);
end
end
