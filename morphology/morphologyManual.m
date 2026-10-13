function J = morphologyManual(I, SE, op)
%MORPHOLOGYMANUAL Erosion or dilation written with explicit loops (educational).
%   J = morphologyManual(I, SE, 'erode')    same result as erodeImage
%   J = morphologyManual(I, SE, 'dilate')   same result as dilateImage
%
%   For each pixel (i,j):
%     1. take the neighbourhood the same size as SE, centred on (i,j)
%     2. keep only the values where SE is 1 (reflected SE for dilation)
%     3. erosion -> minimum of those values, dilation -> maximum

SE = validateSE(SE);
isBinary = islogical(I);
X = double(I);
erode = strcmpi(op, 'erode');
if ~erode && ~strcmpi(op, 'dilate')
    error('ImageLab:invalidParameter', 'Unknown morphological operation "%s".', op);
end
if ~erode, SE = rot90(SE, 2); end        % dilation uses the reflected element
[kh, kw] = size(SE);
pr = (kh - 1) / 2;
pc = (kw - 1) / 2;
[h, w, nc] = size(X);
if erode, padValue = inf; else, padValue = -inf; end
J = zeros(h, w, nc);

for c = 1:nc
    P = padValue * ones(h + 2*pr, w + 2*pc);
    P(pr+1:pr+h, pc+1:pc+w) = X(:,:,c);
    for i = 1:h
        for j = 1:w
            window = P(i:i+kh-1, j:j+kw-1);      % step 1
            values = window(SE);                 % step 2
            if erode
                J(i,j,c) = min(values);          % step 3
            else
                J(i,j,c) = max(values);
            end
        end
    end
end
if isBinary, J = J > 0; end
end
