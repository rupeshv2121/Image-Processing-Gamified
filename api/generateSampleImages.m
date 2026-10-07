function generateSampleImages(force)
%GENERATESAMPLEIMAGES Create ImageLab's synthetic teaching images.
%   The images are built with plain MATLAB matrix operations and written to
%   sample_images/. Existing files are kept unless force = true.

if nargin < 1, force = false; end
root = fileparts(fileparts(mfilename('fullpath')));
outDir = fullfile(root, 'sample_images');
if ~isfolder(outDir), mkdir(outDir); end
rng(7);

% Copy MATLAB's own peppers image so the project is self-contained
pep = which('peppers.png');
target = fullfile(outDir, 'peppers.png');
if ~isempty(pep) && (force || ~isfile(target))
    copyfile(pep, target);
end

[x, y] = meshgrid(1:512, 1:384);

% Low-contrast version of peppers (all grey levels squeezed into 0.35..0.6)
if (force || ~isfile(fullfile(outDir, 'lowcontrast.png'))) && ~isempty(pep)
    P = toGray(imread(pep));
    imwrite(toUint8(0.35 + 0.25 * P), fullfile(outDir, 'lowcontrast.png'));
end

% Geometric shapes on a dark background
if force || ~isfile(fullfile(outDir, 'shapes.png'))
    S = 0.15 * ones(384, 512);
    S((x - 130).^2 + (y - 120).^2 < 70^2) = 0.85;              % circle
    S(220:330, 60:220) = 0.6;                                    % rectangle
    S(abs(x - 380) + abs(y - 130) < 80) = 0.95;                  % diamond
    tri = y > 220 & y < 340 & abs(x - 390) < (y - 220) * 0.9;    % triangle
    S(tri) = 0.45;
    imwrite(toUint8(S), fullfile(outDir, 'shapes.png'));
end

% Smooth horizontal ramp - shows false contouring when quantised
if force || ~isfile(fullfile(outDir, 'gradient.png'))
    Gr = repmat(linspace(0, 1, 512), 384, 1);
    Gr = Gr .* (0.75 + 0.25 * cos(y / 384 * pi));
    imwrite(toUint8(Gr), fullfile(outDir, 'gradient.png'));
end

% Thin lines and isolated points on a textured background
if force || ~isfile(fullfile(outDir, 'lines.png'))
    L = 0.3 + 0.03 * randn(384, 512);
    L(100, 40:470) = 0.9;                                        % horizontal
    L(40:340, 260) = 0.9;                                        % vertical
    for t = 0:250, L(60 + t, 60 + t) = 0.9; end                  % +45 diagonal
    for t = 0:200, L(340 - t, 300 + t) = 0.9; end                % -45 diagonal
    pts = [50 450; 200 420; 330 80; 360 480; 30 30];
    for p = 1:size(pts, 1), L(pts(p, 1), pts(p, 2)) = 1; end
    imwrite(toUint8(L), fullfile(outDir, 'lines.png'));
end

% Bright blobs under a strong illumination gradient
if force || ~isfile(fullfile(outDir, 'unevenlight.png'))
    U = 0.1 + 0.6 * (x / 512);                                   % lighting ramp
    for cx = 60:110:500
        for cy = 60:100:360
            U((x - cx).^2 + (y - cy).^2 < 28^2) = U(cy, cx) + 0.25;
        end
    end
    U = U + 0.02 * randn(size(U));
    imwrite(toUint8(U), fullfile(outDir, 'unevenlight.png'));
end
end
