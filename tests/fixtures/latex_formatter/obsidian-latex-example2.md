## Complex Numbers
### Definition
As tuples or 2vecs:
$$
\begin{gather}
(x,y) \in \mathbb{C} \\
(x,y)\cdot (a,b)=(xa-yb, xb + ya)
\end{gather}
$$
We also define them like vectors with length (*absolute value or modulus*):
$$
\begin{gather}
|z|=|x+yi|=\sqrt{x^2+y^2}
\end{gather}
$$
And with angle (the *argument*):
$$
\begin{gather}
r\cdot \cos \phi = x \\
r\cdot\sin \phi = y
\end{gather}
$$
because $r$ is the absolute (length) of the vector (hypotenuse)

### Multiplication
Multiply 2 complex numbers geometrically by writing them via their arguments:
$$
x+yi=r \cos (\phi)+ r\sin( \phi) i
$$
Then multiply two:
$$
\begin{align}
(x_{1}+y_{1}i)(x_{2}+y_{2}i)&=r_{1}(\cos \phi_{1}+i \sin \phi_{1})+r_{2}(\cos \phi_{2}+i\sin \phi_{2}) \\
&=r_{1}r_{2}(\cos (\phi_{1}+\phi_{2}))+r_{1}r_{2}(\sin(\phi_{1}+\phi_{2}))
\end{align}
$$
***Prop. Squared Absolute***
$$
\begin{align}
|x+yi|^2&=(\sqrt{x^2+y^2})^2=x^2+y^2 \\
&=(x+yi)(x-yi)\quad\text{complex identity for  }x^2+y^2
\end{align}
$$
### Complex Conjugate
$$
\overline{x+yi}=x-yi
$$
Has a lot of nice properties:
$$
\begin{gather}
|z|^2=z\overline{z} \\
\text{Re}(z)=\frac{1}{2}(z+\bar{z}) \\
\text{Im}(z)=\frac{1}{2}(z-\bar{z}) \\ 
\overline{e^{i\theta}}=e^{-i\theta}
\end{gather}
$$
So:
- the *conjugate is closely related to the absolute* when multiplying. 
- adding the conjugate *extracts the real/imaginary parts*
##### Proof: multiply by conjugate relation to norm $z\overline{z}=|z|^2$:
Show: $z\overline{z}=\lvert z \rvert^2$
$$
\begin{align}
z\bar{z}&=(x+yi)(x-yi) \\
&=x^2+y^2 \\
&=(\sqrt{x^2+y^2})^2 \\
&=\lvert z \rvert ^2
\end{align}
$$
##### Proof: Triangle Inequality
Simply that the sides of a triangle together are longer than the hypotenuse (specifically for complex numbers):
Show: $|z_{1}+z_{2}|\leq |z_{1}|+|z_{2}|$

$$
\begin{align} 
\lvert z_{1}+z_{2} \rvert^2&=(z_{1}+z_2)\overline{(z_{1}+z_{2})}  && \text{we start from the square of what we want} \\
 & = (z_{1}+z_{2})(\overline{z_{1}}+\overline{z_{2}}) \\
 & =z_{1}\overline{z_{1}}+(z_{1}\overline{z_{2}}+\overline{z_{1}}z_{2})+z_{2}\overline{z_{2}} \\
 &= \lvert z_{1} \rvert ^2+(z_{1}\overline{z_{2}}+\overline{z_{1}}z_{2})+\lvert z_{2} \rvert ^2 && \text{conjugate to absolute identity}\\
 &= \lvert z_{1} \rvert ^2 + \lvert z_{2} \rvert ^2 + (z_{1}\overline{z_{2}}+\overline{z_{1}\overline{z_{2}}}) && \text{rewrite the middle terms as conjugates of eachother} \\
 &= \lvert z_{1} \rvert ^2 + \lvert z_{2} \rvert ^2 + 2\text{Re}(z_{1}\overline{z_{2}}) && \text{rewrite as Real because we were just adding a conjugate to itself} \\
 &\leq \lvert z_{1} \rvert ^2 + \lvert z_{2} \rvert ^2 + 2\lvert z_{1} \overline{z_{2}} \rvert && \text{norm is always bigger than just the real side} \\
 &=(\lvert z_{1} \rvert +\lvert z_{2} \rvert )^2 && \text{just normal polynomial identity: }x^2+2xy+y^2=x^2+y^2 \\
\lvert z_{1}+z_{2} \rvert &\leq \lvert z_{1} \rvert +\lvert z_{2} \rvert && \text{square root for the final result}
\end{align}
$$

