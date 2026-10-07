function J = applyToLuminance(fn, I)
%APPLYTOLUMINANCE Apply an intensity transform without distorting colours.
%   For grayscale images fn is applied directly. For RGB images the image is
%   converted to HSV, fn is applied to the Value (brightness) channel only,
%   and the result is converted back. Applying histogram equalisation to R,
%   G and B separately would shift the hues - this avoids that.

I = toDouble(I);
if size(I, 3) == 3
    hsv = rgb2hsv(I);
    hsv(:,:,3) = min(max(fn(hsv(:,:,3)), 0), 1);
    J = hsv2rgb(hsv);
else
    J = fn(I);
end
end
