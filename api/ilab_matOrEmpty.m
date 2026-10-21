function m = ilab_matOrEmpty(K)
%ILAB_MATOREMPTY ilab_mat(K), or [] for an empty matrix.
if isempty(K), m = []; else, m = ilab_mat(K); end
end
