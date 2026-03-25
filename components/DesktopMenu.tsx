'use client'

import { useState } from "react";
import { IoChevronDown} from "react-icons/io5"
import { motion } from "framer-motion";
import {MainMenuItem} from "@/app/types"
import { Menus } from "@/lib/utils";
import Link from "next/link";

  export const DesktopMenu = ({ name }:{name: string}) => {
  const [isHover, toggleHover] = useState(false);
  const toggleHoverMenu = () => {
    toggleHover(!isHover);
  };

  const subMenuAnimate = {
    enter: {
      opacity: 1,
      rotateX: 0,
      transition: {
        duration: 0.5,
      },
      display: "block",
    },
    exit: {
      opacity: 0,
      rotateX: -15,
      transition: {
        duration: 0.5,
      },
      transitionEnd: {
        display: "none",
      },
    },
  };

  const menu = Menus.find((item:MainMenuItem) => name === item.name)

  const hasSubMenu = menu?.subMenu?.length;

  return (
    <motion.li
      className="group/link"
      onHoverStart={() => {
        toggleHoverMenu();
      }}
      onHoverEnd={toggleHoverMenu}
      key={menu?.name}
    >
      <span className="flex-center gap-1 hover:bg-white/5 cursor-pointer px-3 py-1 rounded-xl">
      {menu?.link ? <Link href={menu?.link}>{menu?.name}</Link>:menu?.name}
        
        {hasSubMenu && (
          <IoChevronDown className="mt-[0.6px] group-hover/link:rotate-180 duration-200" />
        )}
      </span>
      {hasSubMenu && (
        <motion.div
          className="absolute top-[4.2rem] p-3.75 rounded-[6px] origin-[50%_-170px] backdrop-blur bg-secondary/40"
          initial="exit"
          animate={isHover ? "enter" : "exit"}
          variants={subMenuAnimate}
        >
          <div
            className={`grid gap-7 ${
              menu.gridCols === 3
                ? "grid-cols-3"
                : menu.gridCols === 2
                ? "grid-cols-2"
                : "grid-cols-1"
            }`}
          >
            {hasSubMenu &&
              menu?.subMenu?.map((submenu, i) => (
                <div className="relative cursor-pointer" key={i}>
                  {menu.gridCols && menu.gridCols > 1 && menu?.subMenuHeading?.[i] && (
                    <p className="text-sm mb-4 text-gray-500">
                      {menu?.subMenuHeading?.[i]}
                    </p>
                  )}
                  <div className="flex-center gap-x-4 group/menubox">
                    <div className="bg-primary/90 w-fit p-2 rounded-md group-hover/menubox:opacity-75 group-hover/menubox:text-gray-900 duration-300">
                      {submenu.icon && <submenu.icon className="text-text-dark"/>}
                    </div>
                    <Link href={submenu?.link || '/'}>
                      <h6 className="font-semibold">{submenu.name}</h6>
                      <p className="text-sm text-text dark:text-text-dark">{submenu.desc}</p>
                    </Link>
                  </div>
                </div>
              ))}
          </div>
        </motion.div>
      )}
    </motion.li>
  );
}