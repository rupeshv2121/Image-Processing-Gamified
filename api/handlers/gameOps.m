function data = gameOps(op, p)
%GAMEOPS Image work for the games (the rules and scores live in the backend).
%   data = gameOps(op, p) - called by ilab_dispatch for:
%
%   guessFilter     a random filter applied to the image, with shuffled options
%   degrade         p.id (or p.sample + p.maxSide), p.steps = [{op, value}], p.seed
%                   -> cleanId, degradedId, psnr             (games/degradeImage.m)
%   applyPipeline   p.cleanId, p.degradedId, p.steps = [{block, k, sigma, ...}],
%                   p.intermediate (true: every step's image and quality)
%                   -> id, steps, before, after, processingMs (games/applyBlock.m)

switch op
    case 'guessFilter'
        data = guessFilterRound(ilab_img(p));

    case 'degrade'
        ilab_seed(p);
        I = source(p);
        steps = ilab_param(p, 'steps', {});
        if isstruct(steps), steps = num2cell(steps); end
        steps = cellfun(@(s) {char(s.op), s.value}, reshape(steps, 1, []), 'UniformOutput', false);
        D = degradeImage(I, steps);
        rng('shuffle');
        q = imageQuality(D, I);
        data = struct('cleanId', ilab_put(I, 'clean'), 'degradedId', ilab_put(D, 'degraded'), ...
            'psnr', q.psnr);

    case 'applyPipeline'
        data = applyPipeline(p);

    otherwise
        error('ImageLab:unknownOperation', 'Unknown operation "%s".', op);
end
end

% =========================================================================
function I = source(p)
% The request's image, or a sample image limited to p.maxSide pixels
sample = char(ilab_param(p, 'sample', ''));
if isempty(sample)
    I = ilab_img(p);
    return
end
generateSampleImages(false);
[I, map] = imread(sampleImages('path', sample));
if ~isempty(map), I = ind2rgb(I, map); end
I = ilab_limitSize(toDouble(I(:, :, 1:min(3, size(I, 3)))), ilab_param(p, 'maxSide', 640));
end

function data = applyPipeline(p)
clean = ilab_img(p, 'cleanId');
D = ilab_img(p, 'degradedId');
steps = ilab_param(p, 'steps', {});
if isstruct(steps), steps = num2cell(steps); end   % steps with different fields arrive as a cell
intermediate = isequal(ilab_param(p, 'intermediate', false), true);
J = D;
out = cell(1, numel(steps) * intermediate);
tic;
for k = 1:numel(steps)
    s = steps{k};
    J = applyBlock(J, char(s.block), s);
    if intermediate
        q = imageQuality(J, clean);
        out{k} = struct('block', char(s.block), 'id', ilab_put(J, 'step'), 'psnr', q.psnr);
    end
end
data = struct('id', ilab_put(J, 'result'), 'steps', {out}, 'before', imageQuality(D, clean), ...
    'after', imageQuality(J, clean), 'processingMs', 1000 * toc);
end

function data = guessFilterRound(I)
G = toGray(I);
options = {'Mean', 'Median', 'Gaussian', 'Laplacian', 'Sobel', 'Prewitt'};
explain = {
    'Mean: everything is blurred evenly, and the impulse noise is smeared into grey blobs rather than removed.'
    'Median: the salt & pepper dots vanish completely while edges stay sharp - the signature of the median filter.'
    'Gaussian: a smooth, soft blur; impulses are softened but still visible as faint spots.'
    'Laplacian: flat areas become mid-grey and every edge shows a double (light/dark) line - a second derivative.'
    'Sobel: edges appear bright on black with slightly thick, smooth outlines (1-2-1 weighting).'
    'Prewitt: very similar to Sobel - edges bright on black, slightly noisier because all weights are equal.'};
pick = randi(numel(options));
switch pick
    case 1, input = addSaltPepperNoise(G, 0.06); out = meanFilter(input, 5);
    case 2, input = addSaltPepperNoise(G, 0.06); out = medianFilter(input, 3);
    case 3, input = addSaltPepperNoise(G, 0.06); out = gaussianFilter(input, 7, 1.5);
    case 4, input = G; out = scaleToUnit(filter2D(G, [0 1 0; 1 -4 1; 0 1 0]));
    case 5, input = G; out = ilab_runFilter(G, 'sobel', 3, struct(), 'toolbox');
    case 6, input = G; out = ilab_runFilter(G, 'prewitt', 3, struct(), 'toolbox');
end
order = randperm(numel(options));
data = struct('inputId', ilab_put(input, 'guessin'), 'outputId', ilab_put(out, 'guessout'), ...
    'options', {options(order)}, 'answer', find(order == pick), 'explanation', explain{pick});
end
