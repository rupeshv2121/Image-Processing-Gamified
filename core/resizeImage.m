function J = resizeImage(I, outRows, outCols)
%RESIZEIMAGE Bilinear image resize in base MATLAB (interp2), like imresize.

I = toDouble(I);
[h, w, nc] = size(I);
% Sample positions of the output pixel centres in input coordinates
x = ((1:outCols) - 0.5) * (w / outCols) + 0.5;
y = ((1:outRows) - 0.5) * (h / outRows) + 0.5;
x = min(max(x, 1), w);
y = min(max(y, 1), h);
[X, Y] = meshgrid(x, y);
J = zeros(outRows, outCols, nc);
for c = 1:nc
    J(:,:,c) = interp2(I(:,:,c), X, Y, 'linear');
end
end
