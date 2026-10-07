function Y = rgbToYCbCr(I)
%RGBTOYCBCR RGB -> YCbCr (ITU-R BT.601), same scaling as rgb2ycbcr for doubles.
%       Y  =  16/255 + ( 65.481 R + 128.553 G +  24.966 B) / 255
%       Cb = 128/255 + (-37.797 R -  74.203 G + 112.000 B) / 255
%       Cr = 128/255 + (112.000 R -  93.786 G -  18.214 B) / 255
%   Y = luminance (brightness), Cb/Cr = blue/red colour differences.
%   Used in JPEG and video because the eye is less sensitive to Cb/Cr.

I = toDouble(I);
M = [65.481 128.553 24.966; -37.797 -74.203 112; 112 -93.786 -18.214] / 255;
offset = [16; 128; 128] / 255;
Y = reshape((reshape(I, [], 3) * M') + offset', size(I));
end
