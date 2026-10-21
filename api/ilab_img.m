function I = ilab_img(p, field)
%ILAB_IMG Load the image whose id is in request parameter p.(field) (default 'id').
%   Images are exchanged with the backend as PNG files identified by id (ilab_store).
if nargin < 2, field = 'id'; end
I = ilab_store('load', ilab_param(p, field, ''));
end
