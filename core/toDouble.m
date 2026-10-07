function D = toDouble(I)
%TODOUBLE Convert an image of any class to double in the range [0,1].
%   Equivalent to im2double, written in base MATLAB:
%     uint8   0..255   -> 0..1
%     uint16  0..65535 -> 0..1
%     logical          -> 0 or 1
%     double/single    -> unchanged (assumed already in [0,1])

if isa(I, 'double')
    D = I;
elseif isa(I, 'single') || islogical(I)
    D = double(I);
elseif isinteger(I)
    lo = double(intmin(class(I)));
    hi = double(intmax(class(I)));
    D = (double(I) - lo) / (hi - lo);
else
    error('ImageLab:invalidImage', 'Unsupported image class "%s".', class(I));
end
end
