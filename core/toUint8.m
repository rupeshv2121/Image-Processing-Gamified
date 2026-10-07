function U = toUint8(I)
%TOUINT8 Convert a double image in [0,1] to uint8 (values are clipped).

if isa(I, 'uint8')
    U = I;
    return
end
U = uint8(round(min(max(toDouble(I), 0), 1) * 255));
end
