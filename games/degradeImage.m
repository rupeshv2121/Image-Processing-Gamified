function J = degradeImage(I, steps)
%DEGRADEIMAGE Apply a list of degradations {operation, parameter}.
%   Used to create the problems in the pipeline and challenge games.
%   operations: saltpepper | gaussian | speckle | blur | contrast | dark

J = toDouble(I);
for k = 1:numel(steps)
    op = steps{k}{1};
    v = steps{k}{2};
    switch op
        case 'saltpepper', J = addSaltPepperNoise(J, v);
        case 'gaussian',   J = addGaussianNoise(J, 0, v);
        case 'speckle',    J = addSpeckleNoise(J, v);
        case 'blur',       J = gaussianFilter(J, 2 * ceil(3 * v) + 1, v);
        case 'contrast',   J = 0.5 + (J - 0.5) * v;            % squeeze range
        case 'dark',       J = J .^ (1 / v) * 0.7;             % darken
        otherwise
            error('ImageLab:invalidParameter', 'Unknown degradation "%s".', op);
    end
end
J = min(max(J, 0), 1);
end
