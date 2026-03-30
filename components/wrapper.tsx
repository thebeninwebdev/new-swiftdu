"use client";

import React, { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface WrapperProps {
  children: ReactNode;
  path: string
}

const Wrapper: React.FC<WrapperProps> = ({ children, path}) => {
  const pathname = usePathname();
  const show = !pathname.startsWith(path);

  return (
    <>
      {show &&children}
    </>
  );
};

export default Wrapper;
