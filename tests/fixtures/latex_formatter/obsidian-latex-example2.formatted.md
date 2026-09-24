## Complex Numbers
### Definition
As tuples or 2vecs:
$$
\begin{gather}
  (x,y) \in \mathbb{C} \\
  (x,y) \cdot (a,b) = (xa - yb, xb + ya)
\end{gather}
$$
We also define them like vectors with length (*absolute value or modulus*):
$$
\begin{gather}
  |z| = |x + yi| = \sqrt{x^2 + y^2}
\end{gather}
$$
And with angle (the *argument*):
$$
\begin{gather}
  r \cdot \cos \phi = x \\
  r \cdot \sin \phi = y
\end{gather}
$$
because $r$ is the absolute (length) of the vector (hypotenuse)

### Multiplication
Multiply 2 complex numbers geometrically by writing them via their arguments:
$$
x + yi = r \cos (\phi) + r\sin(\phi) i
$$
Then multiply two:
$$
\begin{align}
  (x_1 + y_1 i)(x_2 + y_2 i)
    &= r_1(\cos \phi_1 + i \sin \phi_1)
       + r_2(\cos \phi_2 + i\sin \phi_2) \\

    &= r_1 r_2(\cos (\phi_1 + \phi_2))
       + r_1 r_2(\sin(\phi_1 + \phi_2))
\end{align}
$$
***Prop. Squared Absolute***
$$
\begin{align}
  |x + yi|^2 &= (\sqrt{x^2 + y^2})^2 = x^2 + y^2 \\
    &= (x + yi)(x - yi) \quad \text{complex identity for }x^2 + y^2
\end{align}
$$
### Complex Conjugate
$$
\overline{x + yi} = x - yi
$$
Has a lot of nice properties:
$$
\begin{gather}
  |z|^2 = z\overline{z} \\
  \text{Re}(z) = \frac{1}{2}(z + \bar{z}) \\
  \text{Im}(z) = \frac{1}{2}(z - \bar{z}) \\
  \overline{e^{i\theta}} = e^{-i\theta}
\end{gather}
$$
So:
- the *conjugate is closely related to the absolute* when multiplying. 
- adding the conjugate *extracts the real/imaginary parts*
##### Proof: multiply by conjugate relation to norm $z\overline{z}=|z|^2$:
Show: $z\overline{z}=\lvert z \rvert^2$
$$
\begin{align}
  z\bar{z} &= (x + yi)(x - yi) \\
    &= x^2 + y^2 \\
    &= (\sqrt{x^2 + y^2})^2 \\
    &= \lvert z \rvert^2
\end{align}
$$
##### Proof: Triangle Inequality
Simply that the sides of a triangle together are longer than the hypotenuse (specifically for complex numbers):
Show: $|z_{1}+z_{2}|\leq |z_{1}|+|z_{2}|$

$$
\begin{align}
  \lvert z_1 + z_2 \rvert^2
    &= (z_1 + z_2)\overline{(z_1 + z_2)}
    && \text{we start from the square of what we want} \\

    &= (z_1 + z_2)(\overline{z_1} + \overline{z_2}) \\
    &= z_1 \overline{z_1}
       + (z_1 \overline{z_2} + \overline{z_1}z_2)
       + z_2 \overline{z_2} \\

    &= \lvert z_1 \rvert^2
       + (z_1 \overline{z_2} + \overline{z_1}z_2)
       + \lvert z_2 \rvert^2
    && \text{conjugate to absolute identity} \\

    &= \lvert z_1 \rvert^2 + \lvert z_2 \rvert^2
       + (z_1 \overline{z_2} + \overline{z_1 \overline{z_2}})
    && \text{rewrite the middle terms as conjugates of eachother} \\

    &= \lvert z_1 \rvert^2 + \lvert z_2 \rvert^2
       + 2\text{Re}(z_1 \overline{z_2})
    && \text{rewrite as Real because we were just adding a conjugate to itself} \\

    &\leq \lvert z_1 \rvert^2 + \lvert z_2 \rvert^2
          + 2\lvert z_1 \overline{z_2} \rvert
    && \text{norm is always bigger than just the real side} \\

    &= (\lvert z_1 \rvert + \lvert z_2 \rvert)^2
    && \text{just normal polynomial identity: }x^2 + 2xy + y^2 = x^2 + y^2 \\

  \lvert z_1 + z_2 \rvert
    &\leq \lvert z_1 \rvert + \lvert z_2 \rvert
    && \text{square root for the final result}
\end{align}
$$

