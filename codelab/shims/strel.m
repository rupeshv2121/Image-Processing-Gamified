function SE = strel(shape, varargin)
%STREL Code Lab stand-in for the toolbox strel. Returns a LOGICAL MATRIX
%   (not a strel object): strel('square',n), strel('disk',r),
%   strel('diamond',r), strel('line',len,0|90), strel('rectangle',[m n]),
%   strel(matrix).
if ~ischar(shape) && ~isstring(shape), SE = logical(shape); return; end
v = varargin;
switch lower(shape)
    case 'square',    SE = structuringElement('square', v{1});
    case 'disk',      SE = structuringElement('disk', 2 * v{1} + 1);
    case 'diamond',   SE = structuringElement('diamond', 2 * v{1} + 1);
    case 'rectangle', SE = true(v{1});
    case 'line'
        if numel(v) > 1 && mod(v{2}, 180) == 90
            SE = structuringElement('vline', v{1});
        else
            SE = structuringElement('hline', v{1});
        end
    otherwise
        error('ImageLab:shim', 'strel (Code Lab version) does not know the shape "%s".', shape);
end
end
