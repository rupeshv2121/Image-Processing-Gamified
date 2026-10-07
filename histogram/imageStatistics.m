function stats = imageStatistics(I)
%IMAGESTATISTICS Basic statistics of the grey levels (0..255 scale).
%   mean     : average brightness
%   variance : spread of the grey levels (contrast)
%   std      : standard deviation = sqrt(variance)
%   entropy  : -sum p log2 p, the average information per pixel in bits
%              (8 bits max for a perfectly flat 256-level histogram)

G = double(toUint8(toGray(I)));
counts = accumarray(G(:) + 1, 1, [256 1]);
p = counts / sum(counts);
p = p(p > 0);

stats = struct( ...
    'mean',     mean(G(:)), ...
    'variance', var(G(:)), ...
    'std',      std(G(:)), ...
    'entropy',  -sum(p .* log2(p)), ...
    'min',      min(G(:)), ...
    'max',      max(G(:)));
end
