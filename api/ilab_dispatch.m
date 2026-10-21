function response = ilab_dispatch(requestJson)
%ILAB_DISPATCH Entry point for the ImageLab backend: MATLAB does the image work.
%   response = ilab_dispatch(requestJson)
%
%   The request is a JSON string {"op": "...", "params": {...}}; the response
%   is {"ok": true, "data": ...} or {"ok": false, "error": "...", "errorId": "..."}.
%   The backend (backend/imagelab, FastAPI) handles sign-in, progress,
%   quizzes and the classroom; it calls this function only for operations
%   that need MATLAB. Each operation lives in an api/handlers/*Ops.m file.
%
%   Images are passed by id (ilab_store). Example:
%       ilab_dispatch('{"op":"loadSample","params":{"name":"peppers.png"}}')

t0 = tic;
op = '';
try
    req = jsondecode(char(requestJson));
    op = char(req.op);
    p = struct();
    if isfield(req, 'params') && isstruct(req.params), p = req.params; end
    handler = handlerFor(op);
    data = handler(op, p);
    response = jsonencode(struct('ok', true, 'op', op, 'data', {data}, ...
        'elapsedMs', 1000 * toc(t0)), 'ConvertInfAndNaN', true);
catch err
    response = jsonencode(struct('ok', false, 'op', op, ...
        'error', friendlyMessage(err), 'errorId', err.identifier));
end
end

% =========================================================================
function handler = handlerFor(op)
% Operation -> handler function (built once per MATLAB session)
persistent table
if isempty(table)
    routes = {
        @imageOps,      {'ping', 'samples', 'loadSample', 'importImage', 'imageInfo', 'grayscale', ...
                         'histogramOf', 'errorMap', 'noise', 'sampling', 'quantize'}
        @filterOps,     {'filter', 'gaussianKernel', 'kernelPreset', 'kernelPresets', 'applyKernel', ...
                         'correlation', 'sharpen', 'compare'}
        @analysisOps,   {'histogram', 'edges', 'segment', 'morphology', 'structuringElement', 'regions', ...
                         'color', 'colorEnhance', 'neighborhood', 'steps'}
        @gameOps,       {'guessFilter', 'degrade', 'applyPipeline'}
        @codeLabOps,    {'codeTaskList', 'codeTaskStart', 'codeTaskSolution', 'codeWarmup', 'runCode'}
        @experimentOps, {'experimentCatalog', 'runExperiment', 'report'}};
    table = containers.Map('KeyType', 'char', 'ValueType', 'any');
    for r = 1:size(routes, 1)
        for k = 1:numel(routes{r, 2})
            table(routes{r, 2}{k}) = routes{r, 1};
        end
    end
end
if ~isKey(table, op)
    error('ImageLab:unknownOperation', 'Unknown operation "%s".', op);
end
handler = table(op);
end

function msg = friendlyMessage(err)
if startsWith(err.identifier, 'ImageLab:')
    msg = err.message;
elseif contains(err.identifier, 'nomem') || contains(err.message, 'memory')
    msg = 'MATLAB ran out of memory. Try a smaller image or kernel.';
elseif contains(err.identifier, 'imread') || contains(err.identifier, 'imagesci')
    msg = 'The image could not be read. Use PNG, JPG, TIF, BMP or GIF.';
elseif contains(err.identifier, 'json')
    msg = 'The request sent to MATLAB was malformed.';
else
    msg = sprintf('MATLAB error: %s', err.message);
end
end
