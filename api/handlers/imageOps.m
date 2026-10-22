function data = imageOps(op, p)
%IMAGEOPS Loading and inspecting images, noise, sampling and quantisation,
%   and the visual-perception / spectrum demos of Unit I.
%   data = imageOps(op, p) - called by ilab_dispatch for:
%   ping, samples, loadSample, importImage, imageInfo, grayscale,
%   histogramOf, errorMap, noise, sampling, quantize, perception, spectrum

switch op
    case 'ping'
        data = struct('version', version, 'release', version('-release'), ...
            'ipt', hasIPT(), 'iptLicensed', license('test', 'image_toolbox') == 1, ...
            'root', fileparts(fileparts(fileparts(mfilename('fullpath')))));

    case 'samples'
        generateSampleImages(false);
        data = ilab_list(sampleImages('list'));

    case 'loadSample'
        name = char(ilab_param(p, 'name', 'peppers.png'));
        generateSampleImages(false);
        data = importImage(sampleImages('path', name), name);

    case 'importImage'                      % only the backend's upload route sends this
        data = importImage(char(ilab_param(p, 'path', '')), char(ilab_param(p, 'name', 'upload')));

    case 'imageInfo'
        data = ilab_describe(ilab_img(p));

    case 'grayscale'
        G = toGray(ilab_img(p));
        data = struct('id', ilab_put(G, 'gray'), 'info', ilab_describe(G));

    case 'histogramOf'
        I = ilab_img(p);
        data = struct('counts', imhistManual(I), 'stats', imageStatistics(I));

    case 'errorMap'
        [H, ~, stats] = errorMap(ilab_img(p), ilab_img(p, 'refId'));
        data = stats;
        data.id = ilab_put(H, 'error');

    case 'noise'
        ilab_seed(p);
        I = ilab_img(p);
        type = char(ilab_param(p, 'type', 'gaussian'));
        N = addNoise(I, type, p);
        q = imageQuality(N, I);
        % The noise PDF: the same noise added to a flat 50% grey patch. Its
        % histogram is how noise parameters are estimated from a flat region.
        flat = addNoise(0.5 * ones(128), type, p);
        data = struct('id', ilab_put(N, 'noisy'), ...
            'diffId', ilab_put(min(abs(N - I) * 3, 1), 'diff'), ...
            'mse', q.mse, 'psnr', q.psnr, ...
            'noisyStats', imageStatistics(N), ...
            'pdf', imhistManual(flat), 'noiseMean', mean(flat(:)) - 0.5, 'noiseStd', std(flat(:)));

    case 'sampling'
        I = ilab_img(p);
        factors = ilab_param(p, 'factors', [1 2 4 8]);
        data = cell(1, numel(factors));
        for k = 1:numel(factors)
            [d, small] = sampleImage(I, factors(k));
            data{k} = struct('factor', factors(k), 'id', ilab_put(d, 'sample'), ...
                'width', size(small, 2), 'height', size(small, 1));
        end

    case 'quantize'
        I = ilab_img(p);
        bits = ilab_param(p, 'bits', [1 2 4 8]);
        data = cell(1, numel(bits));
        for k = 1:numel(bits)
            [J, levels] = quantizeImage(I, bits(k));
            data{k} = struct('bits', bits(k), 'levels', levels, 'id', ilab_put(J, 'quant'), ...
                'psnr', calculatePSNR(J, I), 'uniqueLevels', numel(unique(toUint8(J))));
        end

    case 'perception'
        kind = char(ilab_param(p, 'kind', 'machbands'));
        switch kind
            case 'machbands',    d = perceptionDemo(kind, ilab_param(p, 'steps', 8));
            case 'simultaneous', d = perceptionDemo(kind, ilab_param(p, 'centre', 0.5));
            case 'weber',        d = perceptionDemo(kind, ilab_param(p, 'background', 0.5), ilab_param(p, 'delta', 0.02));
            otherwise,           d = perceptionDemo(kind);
        end
        data = d;
        data.id = ilab_put(d.image, kind);
        data = rmfield(data, 'image');

    case 'spectrum'
        lambda = ilab_param(p, 'wavelength', 550);           % nm
        strip = repmat(reshape(wavelengthToRGB(380:780), 1, [], 3), 60, 1);
        c = 2.998e8; h = 6.626e-34; e = 1.602e-19;
        data = struct('stripId', ilab_put(strip, 'spectrum'), 'wavelength', lambda, ...
            'rgb', wavelengthToRGB(lambda), ...
            'frequencyTHz', c / (lambda * 1e-9) / 1e12, ...
            'energyEV', h * c / (lambda * 1e-9) / e);

    otherwise
        error('ImageLab:unknownOperation', 'Unknown operation "%s".', op);
end
end

% =========================================================================
function data = importImage(file, name)
% Read any supported file, convert to double RGB / grayscale, limit the size
if isempty(file) || ~isfile(file)
    error('ImageLab:noImage', 'The image file could not be found.');
end
try
    [I, map] = imread(file);
    finfo = imfinfo(file);
    finfo = finfo(1);
catch
    error('ImageLab:badFormat', 'This file is not a supported image. Use PNG, JPG, TIF, BMP or GIF.');
end
originalClass = class(I);
if ~isempty(map)
    I = ind2rgb(I, map);
    colorType = 'Indexed (converted to RGB)';
elseif size(I, 3) == 4
    I = I(:, :, 1:3);
    colorType = 'RGB + alpha (alpha removed)';
elseif size(I, 3) == 3
    colorType = 'RGB';
elseif size(I, 3) == 1
    colorType = 'Grayscale';
else
    error('ImageLab:badFormat', 'Images with %d channels are not supported.', size(I, 3));
end
I = toDouble(I);
[h, w, ~] = size(I);
[I, resized] = ilab_limitSize(I);
bitDepth = [];
if isfield(finfo, 'BitDepth'), bitDepth = finfo.BitDepth; end
data = struct('id', ilab_put(I, 'orig'), 'name', name, 'info', ilab_describe(I), ...
    'original', struct('width', w, 'height', h, 'class', originalClass, ...
        'colorType', colorType, 'format', upper(finfo.Format), 'bitDepth', bitDepth, ...
        'fileSizeKB', finfo.FileSize / 1024), ...
    'resized', resized);
end
