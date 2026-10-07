function J = negativeTransform(I)
%NEGATIVETRANSFORM Image negative:  s = (L-1) - r   ( = 1 - r for [0,1] images).
%   Useful for enhancing white or grey detail embedded in dark regions.
J = 1 - toDouble(I);
end
